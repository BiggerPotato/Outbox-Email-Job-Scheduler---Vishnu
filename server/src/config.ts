import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

type SenderConfig = { id: string; name: string; host: string; port: number; secure: boolean; user: string; pass: string; from: string; };
const parseSenders = (): SenderConfig[] => {
  const raw = process.env.SMTP_SENDERS_JSON;
  if (!raw) return [];
  const parsed = JSON.parse(raw) as SenderConfig[];
  if (!Array.isArray(parsed) || parsed.some((s) => !s.id || !s.user || !s.pass || !s.host || !s.from)) throw new Error('SMTP_SENDERS_JSON must be an array of complete sender configurations.');
  return parsed;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  apiOrigin: process.env.API_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://reachinbox:local_dev_only@localhost:5432/reachinbox',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  elasticUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  elasticIndex: process.env.ELASTICSEARCH_INDEX ?? 'reachinbox-emails',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/auth/google/callback',
  slackClientId: process.env.SLACK_CLIENT_ID ?? '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
  slackCallbackUrl: process.env.SLACK_CALLBACK_URL ?? 'http://localhost:3000/auth/slack/callback',
  sessionSecret: process.env.SESSION_SECRET ?? 'local-only-change-this-session-secret',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? 'local-only-change-this-token-key',
  queueDashboardEmails: (process.env.QUEUE_DASHBOARD_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  maxConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  defaultMinDelaySeconds: Number(process.env.MIN_DELAY_SECONDS ?? 2),
  maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR ?? 200),
  senderConfigs: parseSenders(),
  isProduction: process.env.NODE_ENV === 'production',
};

export function validateConfig() {
  if (!config.senderConfigs.length) throw new Error('Set SMTP_SENDERS_JSON with at least one Ethereal sender. Run npm run ethereal to generate credentials.');
  if (config.isProduction && (config.sessionSecret.startsWith('local-only') || config.tokenEncryptionKey.startsWith('local-only'))) throw new Error('Set SESSION_SECRET and TOKEN_ENCRYPTION_KEY before running in production.');
  if (!Number.isInteger(config.maxConcurrency) || config.maxConcurrency < 1) throw new Error('WORKER_CONCURRENCY must be a positive integer.');
  if (!Number.isInteger(config.maxEmailsPerHour) || config.maxEmailsPerHour < 1) throw new Error('MAX_EMAILS_PER_HOUR must be a positive integer.');
  if (!Number.isInteger(config.defaultMinDelaySeconds) || config.defaultMinDelaySeconds < 1) throw new Error('MIN_DELAY_SECONDS must be at least 1.');
}
