import { prisma } from "../config/database";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ValidationError, NotFoundError } from "../utils/errors";
import { addEmailJobs } from "../queues/email.queue";
import {
  CampaignResponse,
  CampaignTimelineEvent,
  CampaignTimelineResponse,
  CampaignWithJobsResponse,
  CreateCampaignDTO,
  EmailJobSummary,
  RecipientStats
} from "../types/campaign.types";
import { PaginationQuery, PaginatedResponse } from "../types/common.types";

/**
 * Campaign orchestration service for creating and retrieving campaigns.
 */
class CampaignService {
  /**
   * Create a campaign, insert jobs, and enqueue them for delivery.
   */
  async createCampaign(
    userId: string,
    data: CreateCampaignDTO
  ): Promise<CampaignResponse & { recipientStats: RecipientStats }> {
    const sender = await prisma.sender.findFirst({
      where: { id: data.senderId, userId }
    });

    if (!sender) {
      throw new NotFoundError("Sender not found", "SENDER_NOT_FOUND");
    }

    const recipients = this.parseRecipients(data.recipients);

    if (recipients.valid.length === 0) {
      throw new ValidationError("No valid recipients", "RECIPIENTS_INVALID");
    }

    const scheduledStartAt = new Date(data.scheduledStartAt);
    if (Number.isNaN(scheduledStartAt.getTime())) {
      throw new ValidationError("Invalid scheduledStartAt", "SCHEDULE_INVALID");
    }
    if (scheduledStartAt.getTime() < Date.now()) {
      throw new ValidationError("Schedule time must be in the future", "SCHEDULE_IN_PAST");
    }

    const effectiveHourlyLimit = Math.min(data.hourlyLimit, env.MAX_EMAILS_PER_HOUR);

    const { campaign, jobs } = await prisma.$transaction(async (tx) => {
      const createdCampaign = await tx.emailCampaign.create({
        data: {
          userId,
          senderId: data.senderId,
          subject: data.subject,
          body: data.body,
          scheduledStartAt,
          delayBetweenEmails: data.delayBetweenEmails,
          hourlyLimit: effectiveHourlyLimit,
          status: "SCHEDULED"
        }
      });

      const jobData = recipients.valid.map((recipientEmail, index) => ({
        campaignId: createdCampaign.id,
        recipientEmail,
        scheduledAt: new Date(scheduledStartAt.getTime() + index * data.delayBetweenEmails)
      }));

      await tx.emailJob.createMany({ data: jobData });

      const createdJobs = await tx.emailJob.findMany({
        where: { campaignId: createdCampaign.id },
        select: {
          id: true,
          recipientEmail: true,
          scheduledAt: true,
          status: true,
          sentAt: true
        }
      });

      return { campaign: createdCampaign, jobs: createdJobs };
    });

    await addEmailJobs(
      jobs.map((job) => ({
        emailJobId: job.id,
        scheduledAt: job.scheduledAt,
        data: {
          emailJobId: job.id,
          campaignId: campaign.id,
          recipientEmail: job.recipientEmail,
          subject: campaign.subject,
          body: campaign.body,
          senderId: campaign.senderId
        }
      }))
    );

    logger.info(
      {
        campaignId: campaign.id,
        userId,
        recipientStats: recipients
      },
      "Campaign created"
    );

    return {
      id: campaign.id,
      userId: campaign.userId,
      senderId: campaign.senderId,
      subject: campaign.subject,
      body: campaign.body,
      scheduledStartAt: campaign.scheduledStartAt.toISOString(),
      delayBetweenEmails: campaign.delayBetweenEmails,
      hourlyLimit: campaign.hourlyLimit,
      status: campaign.status,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      recipientStats: {
        total: data.recipients.length,
        valid: recipients.valid.length,
        invalid: recipients.invalid.length,
        duplicates: recipients.duplicates
      }
    };
  }

  /**
   * Fetch campaigns for a user with pagination and job stats.
   */
  async getCampaigns(
    userId: string,
    query: PaginationQuery & { status?: string; senderId?: string }
  ): Promise<PaginatedResponse<CampaignResponse & { jobStats: Record<string, number> }>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = { userId } as Record<string, unknown>;

    if (query.status) {
      where.status = query.status;
    }

    if (query.senderId) {
      where.senderId = query.senderId;
    }

    const allowedSortFields = new Set(["createdAt", "scheduledStartAt", "status"]);
    const sortField =
      query.sortBy && allowedSortFields.has(query.sortBy) ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const [total, campaigns] = await prisma.$transaction([
      prisma.emailCampaign.count({ where }),
      prisma.emailCampaign.findMany({
        where,
        orderBy: { [sortField]: sortOrder } as Record<string, "asc" | "desc">,
        skip,
        take: limit,
        include: {
          _count: {
            select: { jobs: true }
          },
          jobs: {
            select: { status: true }
          }
        }
      })
    ]);

    const data = campaigns.map((campaign) => {
      const jobStats = campaign.jobs.reduce<Record<string, number>>((acc, job) => {
        acc[job.status] = (acc[job.status] ?? 0) + 1;
        return acc;
      }, {});

      return {
        id: campaign.id,
        userId: campaign.userId,
        senderId: campaign.senderId,
        subject: campaign.subject,
        body: campaign.body,
        scheduledStartAt: campaign.scheduledStartAt.toISOString(),
        delayBetweenEmails: campaign.delayBetweenEmails,
        hourlyLimit: campaign.hourlyLimit,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        jobStats
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Fetch a single campaign and its jobs, enforcing ownership.
   */
  async getCampaignById(campaignId: string, userId: string): Promise<CampaignWithJobsResponse> {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        jobs: {
          select: {
            id: true,
            recipientEmail: true,
            scheduledAt: true,
            status: true,
            sentAt: true
          }
        }
      }
    });

    if (!campaign) {
      throw new NotFoundError("Campaign not found", "CAMPAIGN_NOT_FOUND");
    }

    const jobs: EmailJobSummary[] = campaign.jobs.map((job) => ({
      id: job.id,
      recipientEmail: job.recipientEmail,
      scheduledAt: job.scheduledAt.toISOString(),
      status: job.status,
      sentAt: job.sentAt ? job.sentAt.toISOString() : null
    }));

    return {
      id: campaign.id,
      userId: campaign.userId,
      senderId: campaign.senderId,
      subject: campaign.subject,
      body: campaign.body,
      scheduledStartAt: campaign.scheduledStartAt.toISOString(),
      delayBetweenEmails: campaign.delayBetweenEmails,
      hourlyLimit: campaign.hourlyLimit,
      status: campaign.status,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      jobs
    };
  }

  /**
   * Build a timeline of key events for a campaign.
   */
  async getCampaignTimeline(
    campaignId: string,
    userId: string,
    limit = 200
  ): Promise<CampaignTimelineResponse> {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
      select: {
        id: true,
        subject: true,
        scheduledStartAt: true,
        createdAt: true
      }
    });

    if (!campaign) {
      throw new NotFoundError("Campaign not found", "CAMPAIGN_NOT_FOUND");
    }

    const jobs = await prisma.emailJob.findMany({
      where: { campaignId },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limit, 1),
      select: {
        id: true,
        recipientEmail: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        attempts: true,
        lastError: true
      }
    });

    const events: CampaignTimelineEvent[] = [];

    const addEvent = (event: CampaignTimelineEvent) => {
      events.push(event);
    };

    addEvent({
      id: `campaign-created-${campaign.id}`,
      type: "campaign_created",
      message: `Campaign created`,
      at: campaign.createdAt.toISOString(),
      meta: { subject: campaign.subject }
    });

    addEvent({
      id: `campaign-scheduled-${campaign.id}`,
      type: "campaign_scheduled",
      message: `Campaign scheduled to start`,
      at: campaign.scheduledStartAt.toISOString(),
      meta: { subject: campaign.subject }
    });

    jobs.forEach((job) => {
      const baseMeta = {
        recipientEmail: job.recipientEmail,
        status: job.status,
        attempts: job.attempts
      };

      if (job.status === "RESCHEDULED") {
        addEvent({
          id: `rate-limited-${job.id}`,
          type: "rate_limited",
          message: `Rate limit hit; rescheduled ${job.recipientEmail}`,
          at: job.updatedAt.toISOString(),
          meta: baseMeta
        });
        return;
      }

      if (job.status === "SCHEDULED") {
        addEvent({
          id: `job-scheduled-${job.id}`,
          type: "job_scheduled",
          message: `Scheduled send to ${job.recipientEmail}`,
          at: job.scheduledAt.toISOString(),
          meta: baseMeta
        });
        return;
      }

      if (job.status === "SENDING") {
        addEvent({
          id: `job-sending-${job.id}`,
          type: "job_sending",
          message: `Sending ${job.recipientEmail}`,
          at: job.updatedAt.toISOString(),
          meta: baseMeta
        });
        return;
      }

      if (job.status === "SENT") {
        addEvent({
          id: `job-sent-${job.id}`,
          type: "job_sent",
          message: `Delivered to ${job.recipientEmail}`,
          at: (job.sentAt ?? job.updatedAt).toISOString(),
          meta: baseMeta
        });
        return;
      }

      if (job.status === "FAILED") {
        addEvent({
          id: `job-failed-${job.id}`,
          type: "job_failed",
          message: `Failed delivery to ${job.recipientEmail}`,
          at: job.updatedAt.toISOString(),
          meta: { ...baseMeta, lastError: job.lastError }
        });
      }
    });

    jobs.forEach((job) => {
      if (job.attempts > 1) {
        addEvent({
          id: `job-retry-${job.id}-${job.attempts}`,
          type: "job_retry",
          message: `Retry attempt ${job.attempts} for ${job.recipientEmail}`,
          at: job.updatedAt.toISOString(),
          meta: {
            recipientEmail: job.recipientEmail,
            attempts: job.attempts
          }
        });
      }
    });

    const ordered = events
      .filter((event) => event.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);

    return {
      campaignId: campaign.id,
      events: ordered
    };
  }

  /**
   * Normalize, validate, and de-duplicate recipient emails.
   */
  private parseRecipients(recipients: string[]): {
    valid: string[];
    invalid: string[];
    duplicates: number;
  } {
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    let duplicates = 0;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const raw of recipients) {
      const email = raw.trim().toLowerCase();
      if (!emailRegex.test(email)) {
        invalid.push(raw);
        continue;
      }
      if (seen.has(email)) {
        duplicates += 1;
        continue;
      }
      seen.add(email);
      valid.push(email);
    }

    return { valid, invalid, duplicates };
  }
}

export { CampaignService };
