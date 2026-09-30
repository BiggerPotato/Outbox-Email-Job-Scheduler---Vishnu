import pino, { Logger } from "pino";

import { env } from "../config/env";

const isDevelopment = env.NODE_ENV === "development";

const transport = isDevelopment
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname"
      }
    }
  : undefined;

/**
 * Base application logger.
 */
const logger = pino({
  level: env.LOG_LEVEL,
  transport
});

/**
 * Create a child logger with contextual fields.
 */
const createChildLogger = (context: Record<string, unknown>): Logger => {
  return logger.child(context);
};

export { logger, createChildLogger };
