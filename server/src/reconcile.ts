import { emailQueue } from './redis.js';
import { pool } from './db.js';

// Repair the Postgres/Redis hand-off window on process startup; there is no polling scheduler or cron.
export async function reconcileScheduledJobs() {
  const pending = await pool.query(`SELECT id,sender_id,campaign_id,campaign_hourly_limit,scheduled_at FROM scheduled_emails WHERE status='scheduled' ORDER BY scheduled_at`);
  let restored = 0;
  for (const row of pending.rows) {
    if (await emailQueue.getJob(row.id)) continue;
    await emailQueue.add('send-email', {
      emailId: row.id, senderId: row.sender_id, campaignId: row.campaign_id,
      campaignHourlyLimit: row.campaign_hourly_limit, scheduledAt: new Date(row.scheduled_at).toISOString(),
    }, { jobId: row.id, delay: Math.max(0, new Date(row.scheduled_at).getTime() - Date.now()) });
    restored++;
  }
  if (restored) console.log(`[recovery] restored ${restored} scheduled job(s) from PostgreSQL`);
}
