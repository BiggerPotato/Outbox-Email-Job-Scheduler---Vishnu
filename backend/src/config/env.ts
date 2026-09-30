import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    /**
     * Runtime environment (development, production, test).
     */
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /**
     * HTTP server port.
     */
    PORT: z.coerce.number().int().positive().default(3001),
    /**
     * Postgres connection string.
     */
    DATABASE_URL: z.string().url(),
    /**
     * Redis host.
     */
    REDIS_HOST: z.string().min(1),
    /**
     * Redis port.
     */
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    /**
     * Google OAuth client ID.
     */
    GOOGLE_CLIENT_ID: z.string().min(1),
    /**
     * Google OAuth client secret.
     */
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    /**
     * Google OAuth callback URL.
     */
    GOOGLE_CALLBACK_URL: z.string().url(),
    /**
     * JWT signing secret.
     */
    JWT_SECRET: z.string().min(1),
    /**
     * SMTP host for Ethereal.
     */
    SMTP_HOST: z.string().min(1),
    /**
     * SMTP port for Ethereal.
     */
    SMTP_PORT: z.coerce.number().int().positive(),
    /**
     * SMTP username for Ethereal.
     */
    SMTP_USER: z.string().min(1),
    /**
     * SMTP password for Ethereal.
     */
    SMTP_PASS: z.string().min(1),
    /**
     * BullMQ worker concurrency.
     */
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
    /**
     * Minimum delay between sends in milliseconds.
     */
    MIN_DELAY_BETWEEN_EMAILS: z.coerce.number().int().min(1000).default(2000),
    /**
     * Maximum emails allowed per hour per sender.
     */
    MAX_EMAILS_PER_HOUR: z.coerce.number().int().min(1).default(200),
    /**
     * Frontend base URL for CORS.
     */
    FRONTEND_URL: z.string().url(),
    /**
     * Logging level for pino.
     */
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug")
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be at least 32 characters in production"
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${formatted}`);
}

export const env = parsed.data;
export type Env = typeof env;
