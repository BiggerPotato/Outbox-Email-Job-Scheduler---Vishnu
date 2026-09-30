import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { env } from "./config/env";
import { requestLogger } from "./middleware/request-logger";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { campaignRouter } from "./routes/campaign.routes";
import { jobRouter } from "./routes/job.routes";
import { healthRouter } from "./routes/health.routes";
import { senderRouter } from "./routes/sender.routes";
import { csvRouter } from "./routes/csv.routes";
import { NotFoundError } from "./utils/errors";
import { logger } from "./utils/logger";
import { prisma } from "./config/database";
import { redisClient } from "./config/redis";
import { emailQueue } from "./queues/email.queue";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL
    },
    (_accessToken, _refreshToken, profile, done) => {
      done(null, profile);
    }
  )
);

app.use(passport.initialize());

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use("/api", authRouter);
app.use("/api", campaignRouter);
app.use("/api", jobRouter);
app.use("/api", healthRouter);
app.use("/api", senderRouter);
app.use("/api", csvRouter);

app.use((_req, _res, next) => {
  next(new NotFoundError("Route not found", "ROUTE_NOT_FOUND"));
});

app.use(errorHandler);

const server = http.createServer(app);

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (error) {
    logger.error({ error }, "Database connection failed");
  }

  try {
    await redisClient.ping();
    logger.info("Redis connected");
  } catch (error) {
    logger.error({ error }, "Redis connection failed");
  }

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      "API listening"
    );
  });
};

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down server");
  server.close(async () => {
    try {
      await emailQueue.close();
    } catch (error) {
      logger.error({ error }, "Failed to close BullMQ queue");
    }

    try {
      await prisma.$disconnect();
    } catch (error) {
      logger.error({ error }, "Failed to disconnect Prisma");
    }

    try {
      await redisClient.quit();
    } catch (error) {
      logger.error({ error }, "Failed to disconnect Redis");
    }

    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void startServer();

export { app };
