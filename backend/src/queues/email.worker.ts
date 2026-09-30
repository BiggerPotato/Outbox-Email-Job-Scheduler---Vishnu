import { Worker } from "bullmq";

import { env } from "../config/env";
import { prisma } from "../config/database";
import { EmailService } from "../services/email.service";
import { RateLimitService } from "../services/rate-limit.service";
import { bullConnection } from "./connection";
import { EmailJobData, QueueNames } from "./types";
import { logger } from "../utils/logger";

const emailService = new EmailService();
const rateLimitService = new RateLimitService();

const worker = new Worker<EmailJobData>(
  QueueNames.EMAIL_QUEUE,
  async (job) => {
    const { emailJobId, campaignId, recipientEmail, subject, body, senderId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const context = { emailJobId, campaignId, recipientEmail, attempt, maxAttempts };

    // Idempotency guard: we only process jobs still marked as scheduled/rescheduled.
    // If the status is already SENT/FAILED/SENDING, another worker handled it.
    const existingJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId }
    });

    if (!existingJob || !["SCHEDULED", "RESCHEDULED"].includes(existingJob.status)) {
      logger.warn({ ...context, status: existingJob?.status }, "Skipping job; already processed");
      return;
    }

    // Atomic transition prevents concurrent workers from sending duplicates.
    // updateMany with a status condition acts like a compare-and-swap.
    const updated = await prisma.emailJob.updateMany({
      where: { id: emailJobId, status: { in: ["SCHEDULED", "RESCHEDULED"] } },
      data: { status: "SENDING" }
    });

    if (updated.count === 0) {
      logger.warn({ ...context }, "Job was claimed by another worker");
      return;
    }

    logger.info({ ...context }, "Job started");

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      select: { hourlyLimit: true }
    });

    if (!campaign) {
      logger.error({ ...context }, "Campaign not found for job");
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "FAILED", lastError: "Campaign not found" }
      });
      return;
    }

    // Sliding window rate limit check; if exceeded we reschedule into next slot.
    const hourlyLimit = Math.min(campaign.hourlyLimit, env.MAX_EMAILS_PER_HOUR);
    const rateLimit = await rateLimitService.checkRateLimit(
      senderId,
      hourlyLimit,
      env.MIN_DELAY_BETWEEN_EMAILS
    );

    if (!rateLimit.allowed && rateLimit.nextAvailableSlot) {
      // Rate limit hit: reschedule the existing job into the next available window.
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "RESCHEDULED", scheduledAt: rateLimit.nextAvailableSlot }
      });

      await job.moveToDelayed(rateLimit.nextAvailableSlot.getTime());
      logger.info({ ...context, nextAvailableSlot: rateLimit.nextAvailableSlot }, "Job rescheduled");
      return;
    }

    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      select: { email: true }
    });

    if (!sender) {
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "FAILED", lastError: "Sender not found" }
      });
      logger.error({ ...context }, "Sender not found for job");
      return;
    }

    try {
      await emailService.sendEmail(emailJobId, recipientEmail, subject, body, sender.email);
      logger.info({ ...context }, "Job completed");
    } catch (error) {
      const lastError = error instanceof Error ? error.message : "Unknown error";
      const isFinalAttempt = attempt >= maxAttempts;

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: isFinalAttempt ? "FAILED" : "SCHEDULED",
          lastError,
          attempts: { increment: 1 }
        }
      });

      logger.error({ ...context, error: lastError, isFinalAttempt }, "Job failed");
      throw error;
    }
  },
  {
    connection: bullConnection,
    concurrency: env.WORKER_CONCURRENCY,
    limiter: {
      max: 1,
      duration: env.MIN_DELAY_BETWEEN_EMAILS
    }
  }
);

worker.on("completed", (job) => {
  logger.info({ emailJobId: job.id }, "Worker completed job");
});

worker.on("failed", (job, err) => {
  logger.error({ emailJobId: job?.id, err }, "Worker failed job");
});

worker.on("error", (err) => {
  logger.error({ err }, "Worker error");
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down worker");
  await worker.close();
  await prisma.$disconnect();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
