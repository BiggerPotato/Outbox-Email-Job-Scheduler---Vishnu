import { Queue } from "bullmq";

import { logger } from "../utils/logger";
import { bullConnection } from "./connection";
import { EmailJobData, QueueNames } from "./types";

/**
 * Queue instance for email sending jobs.
 */
const emailQueue = new Queue<EmailJobData>(QueueNames.EMAIL_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 }
  }
});

/**
 * Add a single email job to the queue with idempotent jobId.
 */
const addEmailJob = async (emailJobId: string, data: EmailJobData, scheduledAt: Date) => {
  const delay = Math.max(scheduledAt.getTime() - Date.now(), 0);
  const job = await emailQueue.add("send", data, {
    jobId: emailJobId,
    delay
  });

  logger.info({ emailJobId, scheduledAt, delay }, "Email job enqueued");
  return job;
};

/**
 * Add multiple email jobs in bulk to the queue.
 */
const addEmailJobs = async (
  jobs: Array<{ emailJobId: string; data: EmailJobData; scheduledAt: Date }>
) => {
  const bulk = jobs.map((job) => ({
    name: "send",
    data: job.data,
    opts: {
      jobId: job.emailJobId,
      delay: Math.max(job.scheduledAt.getTime() - Date.now(), 0)
    }
  }));

  const added = await emailQueue.addBulk(bulk);

  logger.info({ count: added.length }, "Bulk email jobs enqueued");
  return added;
};

export { emailQueue, addEmailJob, addEmailJobs };
