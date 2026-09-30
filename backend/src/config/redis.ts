import IORedis from "ioredis";

import { env } from "./env";
import { logger } from "../utils/logger";

/**
 * Shared Redis client with retry strategy and event logging.
 */
const redisClient = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  retryStrategy: (attempts) => {
    if (attempts > 10) {
      logger.error({ attempts }, "Redis retry attempts exceeded");
      return null;
    }
    const delay = Math.min(1000 * 2 ** (attempts - 1), 15000);
    logger.warn({ attempts, delay }, "Redis reconnecting with backoff");
    return delay;
  }
});

redisClient.on("connect", () => logger.info("Redis connect"));
redisClient.on("ready", () => logger.info("Redis ready"));
redisClient.on("error", (error) => logger.error({ error }, "Redis error"));
redisClient.on("close", () => logger.warn("Redis connection closed"));
redisClient.on("reconnecting", (time: number) => logger.warn({ time }, "Redis reconnecting"));

const shutdownRedis = async (signal: string) => {
  logger.info({ signal }, "Shutting down Redis client");
  try {
    await redisClient.quit();
  } catch (error) {
    logger.error({ error }, "Error during Redis shutdown");
  }
};

process.on("SIGINT", () => void shutdownRedis("SIGINT"));
process.on("SIGTERM", () => void shutdownRedis("SIGTERM"));

export { redisClient };
