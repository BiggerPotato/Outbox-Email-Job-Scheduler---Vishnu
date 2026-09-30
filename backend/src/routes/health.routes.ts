import { Router } from "express";

import { prisma } from "../config/database";
import { redisClient } from "../config/redis";
import { emailQueue } from "../queues/email.queue";
import { logger } from "../utils/logger";
import { env } from "../config/env";

/**
 * Health check routes.
 */
const router = Router();

/**
 * Simple health check.
 */
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Detailed health check for database, redis, and queue.
 */
router.get("/health/detailed", async (_req, res) => {
  const health = {
    database: { ok: false as boolean, error: "" as string | null },
    redis: { ok: false as boolean, error: "" as string | null },
    queue: {
      ok: false as boolean,
      error: "" as string | null,
      stats: {} as Record<string, number>
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database.ok = true;
    health.database.error = null;
  } catch (error) {
    health.database.ok = false;
    health.database.error = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error }, "Database health check failed");
  }

  try {
    const ping = await redisClient.ping();
    health.redis.ok = ping === "PONG";
    health.redis.error = health.redis.ok ? null : "Redis ping failed";
  } catch (error) {
    health.redis.ok = false;
    health.redis.error = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error }, "Redis health check failed");
  }

  try {
    const stats = await emailQueue.getJobCounts("wait", "active", "delayed", "completed", "failed");
    health.queue.ok = true;
    health.queue.error = null;
    health.queue.stats = stats;
  } catch (error) {
    health.queue.ok = false;
    health.queue.error = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error }, "Queue health check failed");
  }

  const allHealthy = health.database.ok && health.redis.ok && health.queue.ok;
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    health
  });
});

/**
 * Returns runtime configuration for the worker.
 */
router.get("/config", (_req, res) => {
  res.status(200).json({
    workerConcurrency: env.WORKER_CONCURRENCY,
    minDelayBetweenEmails: env.MIN_DELAY_BETWEEN_EMAILS,
    maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR
  });
});

export { router as healthRouter };
