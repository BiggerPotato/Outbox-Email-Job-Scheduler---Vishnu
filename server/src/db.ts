import pg from 'pg';
import { config } from './config.js';
import { encrypt } from './security.js';
const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS senders (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, host TEXT NOT NULL, port INTEGER NOT NULL, secure BOOLEAN NOT NULL DEFAULT false,
      smtp_user TEXT NOT NULL, smtp_pass TEXT NOT NULL, from_address TEXT NOT NULL, max_per_hour INTEGER NOT NULL DEFAULT 200,
      min_delay_seconds INTEGER NOT NULL DEFAULT 2, enabled BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS scheduled_emails (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), sender_id TEXT NOT NULL REFERENCES senders(id),
      recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, campaign_id UUID NOT NULL,
      campaign_hourly_limit INTEGER NOT NULL DEFAULT 200,
      scheduled_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','sending','sent','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0, failure_reason TEXT, preview_url TEXT, queue_job_id TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
    );
    ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS campaign_hourly_limit INTEGER NOT NULL DEFAULT 200;
    CREATE INDEX IF NOT EXISTS scheduled_emails_user_status_time_idx ON scheduled_emails(user_id, status, scheduled_at DESC);
    CREATE INDEX IF NOT EXISTS scheduled_emails_sender_time_idx ON scheduled_emails(sender_id, scheduled_at);
    CREATE TABLE IF NOT EXISTS slack_connections (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, team_id TEXT NOT NULL, team_name TEXT NOT NULL,
      slack_user_id TEXT NOT NULL, access_token TEXT NOT NULL, connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  for (const sender of config.senderConfigs) {
    await pool.query(`INSERT INTO senders (id,name,host,port,secure,smtp_user,smtp_pass,from_address,max_per_hour,min_delay_seconds)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,host=EXCLUDED.host,port=EXCLUDED.port,secure=EXCLUDED.secure,
      smtp_user=EXCLUDED.smtp_user,smtp_pass=EXCLUDED.smtp_pass,from_address=EXCLUDED.from_address,
      max_per_hour=EXCLUDED.max_per_hour,min_delay_seconds=EXCLUDED.min_delay_seconds`,
      [sender.id, sender.name, sender.host, sender.port, sender.secure, encrypt(sender.user), encrypt(sender.pass), sender.from, config.maxEmailsPerHour, config.defaultMinDelaySeconds]);
  }
}
