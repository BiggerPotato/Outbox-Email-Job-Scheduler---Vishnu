import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { config } from './config.js';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
export const emailQueue = new Queue('scheduled-emails', {
  connection: redis,
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: false, removeOnFail: false },
});
