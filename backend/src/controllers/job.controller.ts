import { Response, NextFunction } from "express";
import { JobStatus } from "@prisma/client";

import { prisma } from "../config/database";
import { emailQueue } from "../queues/email.queue";
import { RequestWithUser } from "../types/common.types";
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";

const getUserId = (req: RequestWithUser): string => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthError("Missing authentication token", "AUTH_MISSING");
  }
  return userId;
};

/**
 * Lists scheduled/rescheduled jobs for the authenticated user.
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20, max 100)
 *   - sortBy: string (default "scheduledAt")
 *   - sortOrder: "asc" | "desc" (default "desc")
 */
const getScheduledJobs = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const skip = (page - 1) * limit;
    const allowedSortFields = new Set(["scheduledAt", "createdAt", "updatedAt"]);
    const sortBy =
      typeof req.query.sortBy === "string" && allowedSortFields.has(req.query.sortBy)
        ? req.query.sortBy
        : "scheduledAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const allowedStatuses: JobStatus[] = ["SCHEDULED", "SENDING", "RESCHEDULED"];
    const requestedStatus =
      typeof req.query.status === "string" ? req.query.status.toUpperCase() : null;
    const statusFilter =
      requestedStatus && allowedStatuses.includes(requestedStatus as JobStatus)
        ? (requestedStatus as JobStatus)
        : null;

    const where = {
      status: statusFilter ? statusFilter : { in: allowedStatuses },
      campaign: { userId }
    };

    const [total, jobs] = await prisma.$transaction([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { [sortBy]: sortOrder } as Record<string, "asc" | "desc">,
        skip,
        take: limit,
        include: {
          campaign: { select: { subject: true } }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        data: jobs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error({ error }, "Get scheduled jobs failed");
    next(error);
  }
};

/**
 * Lists sent/failed jobs for the authenticated user.
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20, max 100)
 *   - sortBy: string (default "updatedAt")
 *   - sortOrder: "asc" | "desc" (default "desc")
 */
const getSentJobs = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const skip = (page - 1) * limit;
    const allowedSortFields = new Set(["sentAt", "updatedAt", "createdAt"]);
    const sortBy =
      typeof req.query.sortBy === "string" && allowedSortFields.has(req.query.sortBy)
        ? req.query.sortBy
        : "updatedAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const allowedStatuses: JobStatus[] = ["SENT", "FAILED"];
    const requestedStatus =
      typeof req.query.status === "string" ? req.query.status.toUpperCase() : null;
    const statusFilter =
      requestedStatus && allowedStatuses.includes(requestedStatus as JobStatus)
        ? (requestedStatus as JobStatus)
        : null;

    const where = {
      status: statusFilter ? statusFilter : { in: allowedStatuses },
      campaign: { userId }
    };

    const [total, jobs] = await prisma.$transaction([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { [sortBy]: sortOrder } as Record<string, "asc" | "desc">,
        skip,
        take: limit,
        include: {
          campaign: { select: { subject: true } }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        data: jobs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error({ error }, "Get sent jobs failed");
    next(error);
  }
};

/**
 * Cancels a scheduled/rescheduled job for the authenticated user.
 */
const cancelScheduledJob = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const jobId = req.params.id;

    const job = await prisma.emailJob.findUnique({
      where: { id: jobId },
      include: { campaign: { select: { userId: true } } }
    });

    if (!job) {
      throw new NotFoundError("Job not found", "JOB_NOT_FOUND");
    }

    if (job.campaign.userId !== userId) {
      throw new ForbiddenError("Job does not belong to user", "JOB_FORBIDDEN");
    }

    if (!["SCHEDULED", "RESCHEDULED"].includes(job.status)) {
      throw new ValidationError("Only scheduled jobs can be canceled", "JOB_NOT_CANCELABLE");
    }

    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: "CANCELED" }
    });

    try {
      const queuedJob = await emailQueue.getJob(jobId);
      if (queuedJob) {
        await queuedJob.remove();
      }
    } catch (error) {
      logger.warn({ error, jobId }, "Failed to remove job from queue");
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ error }, "Cancel job failed");
    next(error);
  }
};

export { getScheduledJobs, getSentJobs, cancelScheduledJob };
