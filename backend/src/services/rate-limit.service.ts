import { redisClient } from "../config/redis";
import { logger } from "../utils/logger";

/**
 * Sliding window rate limiter backed by Redis sorted sets.
 */
class RateLimitService {
  private getKey(senderId: string) {
    return `rate-limit:${senderId}`;
  }

  /**
   * Sliding window rate limit using Redis sorted sets.
   *
   * We store each send timestamp as a member in a ZSET:
   * - score: timestamp (ms)
   * - member: unique value per send (timestamp + random suffix)
   *
   * To compute the current window:
   * 1) Remove entries older than 1 hour
   * 2) Count remaining entries
   * 3) If at limit, compute next slot from oldest entry + 1 hour
   */
  /**
   * Check and record the current send within the last hour window.
   */
  async checkRateLimit(
    senderId: string,
    maxPerHour: number,
    minDelayBetweenEmails = 0
  ): Promise<{ allowed: boolean; nextAvailableSlot?: Date }> {
    const key = this.getKey(senderId);
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000;

    const pipeline = redisClient.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    const results = await pipeline.exec();

    const count = results?.[1]?.[1] as number | undefined;
    if (typeof count !== "number") {
      logger.warn({ senderId }, "Rate limit count unavailable, allowing send");
      return { allowed: true };
    }

    if (count >= maxPerHour) {
      const oldest = await redisClient.zrange(key, 0, 0, "WITHSCORES");
      const oldestScore = oldest[1] ? Number(oldest[1]) : now;
      const baseSlotMs = oldestScore + 60 * 60 * 1000;
      const perHourSpacing = Math.ceil((60 * 60 * 1000) / Math.max(maxPerHour, 1));
      const spacingMs = Math.max(minDelayBetweenEmails, perHourSpacing, 0);
      const sequenceKey = `${key}:reschedule:${baseSlotMs}`;
      const sequence = await redisClient.incr(sequenceKey);
      await redisClient.expire(sequenceKey, 60 * 60 * 2);
      return {
        allowed: false,
        nextAvailableSlot: new Date(baseSlotMs + (sequence - 1) * spacingMs)
      };
    }

    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    const addPipeline = redisClient.multi();
    addPipeline.zadd(key, now, member);
    addPipeline.expire(key, 60 * 60 * 2);
    await addPipeline.exec();

    return { allowed: true };
  }

  /**
   * Returns the next available slot based on the oldest entry in the window.
   */
  async getNextAvailableSlot(senderId: string): Promise<Date> {
    const key = this.getKey(senderId);
    const oldest = await redisClient.zrange(key, 0, 0, "WITHSCORES");
    const oldestScore = oldest[1] ? Number(oldest[1]) : Date.now();
    return new Date(oldestScore + 60 * 60 * 1000);
  }

  /**
   * Returns current count for the last hour window.
   */
  async getCurrentCount(senderId: string): Promise<number> {
    const key = this.getKey(senderId);
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000;
    await redisClient.zremrangebyscore(key, 0, windowStart);
    return redisClient.zcard(key);
  }
}

export { RateLimitService };
