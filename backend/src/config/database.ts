import { PrismaClient } from "@prisma/client";

import { env } from "./env";
import { logger } from "../utils/logger";

/**
 * Prisma client singleton to prevent exhausting the connection pool.
 * In serverless or dev hot-reload environments, multiple client instances
 * can be created unless the instance is cached globally.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared Prisma client instance.
 */
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const handleShutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down Prisma client");
  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ error }, "Error during Prisma shutdown");
  }
};

process.on("SIGINT", () => void handleShutdown("SIGINT"));
process.on("SIGTERM", () => void handleShutdown("SIGTERM"));

prisma
  .$connect()
  .then(() => logger.info("Prisma client connected"))
  .catch((error) => logger.error({ error }, "Prisma connection error"));

export { prisma };
