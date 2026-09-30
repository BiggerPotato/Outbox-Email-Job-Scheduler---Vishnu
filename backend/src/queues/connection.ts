import type { RedisOptions } from "ioredis";

import { env } from "../config/env";

export const bullConnection: RedisOptions = {
  host: env.REDIS_HOST ?? "127.0.0.1",
  port: env.REDIS_PORT ?? 6379,
  // Required for BullMQ blocking commands.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false
};
