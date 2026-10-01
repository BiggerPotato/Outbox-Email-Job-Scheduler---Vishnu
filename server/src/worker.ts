import nodemailer, { type Transporter } from 'nodemailer';
import { DelayedError, Worker, type Job } from 'bullmq';
import { config, validateConfig } from './config.js';
import { initializeDatabase, pool } from './db.js';
import { redis, emailQueue } from './redis.js';
import { indexEmail } from './email-index.js';
import { notifyHourlyLimit } from './slack.js';
import { reconcileScheduledJobs } from './reconcile.js';
import { decrypt } from './security.js';

type ScheduledEmail = { emailId: string; senderId: string; campaignId: string; campaignHourlyLimit: number; reservedFor?: number; scheduledAt: string };
type Sender = { sender_key: string; name: string; host: string; port: number; secure: boolean; smtp_user: string; smtp_pass: string; from_address: string; max_per_hour: number; min_delay_seconds: number };

validateConfig();
await initializeDatabase();
await reconcileScheduledJobs();
const smtpCache = new Map<string, Transporter>();
const reservationScript = `
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])
local senderLimit = tonumber(ARGV[3])
local campaignLimit = tonumber(ARGV[4])
local campaign = ARGV[5]
local candidate = math.max(now, tonumber(redis.call('GET', KEYS[1]) or '0') + delay)
local hitLimit = 0
local hitWindow = 0
for i=1,48 do
  local window = math.floor(candidate / 3600000) * 3600000
  local senderKey = KEYS[2] .. ':' .. window
  local campaignKey = KEYS[3] .. ':' .. campaign .. ':' .. window
  local senderCount = tonumber(redis.call('GET', senderKey) or '0')
  local campaignCount = tonumber(redis.call('GET', campaignKey) or '0')
  if senderCount < senderLimit and campaignCount < campaignLimit then
    redis.call('INCR', senderKey); redis.call('EXPIRE', senderKey, 172800)
    redis.call('INCR', campaignKey); redis.call('EXPIRE', campaignKey, 172800)
    redis.call('SET', KEYS[1], candidate, 'PX', 172800000)
    return {candidate, window, hitLimit, hitWindow}
  end
  hitLimit = 1
  hitWindow = window
  candidate = window + 3600000
end
return {candidate, math.floor(candidate / 3600000) * 3600000, hitLimit, hitWindow}
`;

function transporterFor(sender: Sender) {
  let transporter = smtpCache.get(sender.sender_key);
  if (!transporter) {
    transporter = nodemailer.createTransport({ host: sender.host, port: sender.port, secure: sender.secure,
      auth: { user: decrypt(sender.smtp_user), pass: decrypt(sender.smtp_pass) }, connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 120000 });
    smtpCache.set(sender.sender_key, transporter);
  }
  return transporter;
}

async function delayJob(job: Job<ScheduledEmail>, token: string, until: number) {
  await job.updateData({ ...job.data, reservedFor: until });
  await job.moveToDelayed(until, token);
  throw new DelayedError();
}

const worker = new Worker<ScheduledEmail>('scheduled-emails', async (job, token) => {
  if (!token) throw new Error('BullMQ did not provide a lock token for this job.');
  const result = await pool.query('SELECT e.*,s.id AS sender_key,s.name AS sender_name,s.host,s.port,s.secure,s.smtp_user,s.smtp_pass,s.from_address,s.max_per_hour,s.min_delay_seconds FROM scheduled_emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1', [job.data.emailId]);
  if (!result.rowCount) { console.warn(`[worker] job ${job.id} has no database record; skipping`); return; }
  const row = result.rows[0] as Sender & { id: string; user_id: string; recipient: string; subject: string; body: string; status: string; attempts: number; sender_name: string };
  if (row.status !== 'scheduled') return;

  const now = Date.now();
  let reservedFor = Number(job.data.reservedFor ?? 0);
  if (!reservedFor) {
    const reservation = await redis.eval(reservationScript, 3,
      `sender:last-slot:${row.sender_key}`, `sender:hour:${row.sender_key}`, `campaign:hour:${row.sender_key}`,
      String(now), String(row.min_delay_seconds * 1000), String(row.max_per_hour),
      String(Math.min(job.data.campaignHourlyLimit, row.max_per_hour)), job.data.campaignId,
    ) as number[];
    const [slot, , limitHit, hitWindow] = reservation;
    reservedFor = Number(slot);
    if (Number(limitHit) && reservedFor > now) {
      const notifyKey = `slack:limit-notified:${row.sender_key}:${hitWindow}`;
      const firstHit = await redis.set(notifyKey, '1', 'EX', 7200, 'NX');
      if (firstHit) {
        try { await notifyHourlyLimit(row.user_id, row.sender_name, Math.min(job.data.campaignHourlyLimit, row.max_per_hour), Number(hitWindow)); }
        catch (error) { console.error(`[worker] Slack notification failed: ${(error as Error).message}`); }
      }
    }
  }
  if (reservedFor > Date.now()) await delayJob(job, token, reservedFor);

  const lockKey = `sender:lock:${row.sender_key}`;
  const lockValue = `${job.id}:${token}`;
  const lock = await redis.set(lockKey, lockValue, 'PX', 300000, 'NX');
  if (!lock) await delayJob(job, token, Date.now() + 500);
  try {
    const lastStart = Number(await redis.get(`sender:last-start:${row.sender_key}`) ?? '0');
    const nextStart = lastStart + row.min_delay_seconds * 1000;
    if (Date.now() < nextStart) await delayJob(job, token, nextStart);

    const claimed = await pool.query(`UPDATE scheduled_emails SET status='sending',attempts=attempts+1,updated_at=now()
      WHERE id=$1 AND status='scheduled' RETURNING id`, [job.data.emailId]);
    if (!claimed.rowCount) return;

    await redis.set(`sender:last-start:${row.sender_key}`, String(Date.now()), 'PX', 172800000);
    try {
      const info = await transporterFor(row).sendMail({ from: row.from_address, to: row.recipient, subject: row.subject, text: row.body });
      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      await pool.query(`UPDATE scheduled_emails SET status='sent',sent_at=now(),preview_url=$2,updated_at=now() WHERE id=$1`, [job.data.emailId, previewUrl]);
      const updated = await pool.query(`SELECT e.id,e.user_id,e.sender_id,e.recipient,e.subject,e.body,e.status,e.scheduled_at,e.sent_at,e.created_at,e.preview_url,e.failure_reason,s.name AS sender_name
        FROM scheduled_emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1`, [job.data.emailId]);
      await indexEmail(updated.rows[0]).catch((error) => console.error(`[worker] Elasticsearch update failed: ${(error as Error).message}`));
      console.log(`[worker] sent ${job.id} to ${row.recipient}${previewUrl ? ` · ${previewUrl}` : ''}`);
    } catch (error) {
      await pool.query(`UPDATE scheduled_emails SET status='scheduled',failure_reason=$2,updated_at=now() WHERE id=$1 AND status='sending'`, [job.data.emailId, (error as Error).message.slice(0, 1000)]);
      throw error;
    }
  } finally {
    await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", 1, lockKey, lockValue);
  }
}, {
  connection: redis,
  concurrency: config.maxConcurrency,
  stalledInterval: 30000,
  maxStalledCount: 1,
});

worker.on('failed', async (job, error) => {
  console.error(`[worker] job ${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
    await pool.query(`UPDATE scheduled_emails SET status='failed',failure_reason=$2,updated_at=now() WHERE id=$1 AND status<>'sent'`, [job.data.emailId, error.message.slice(0, 1000)]).catch(console.error);
    const updated = await pool.query(`SELECT e.id,e.user_id,e.sender_id,e.recipient,e.subject,e.body,e.status,e.scheduled_at,e.sent_at,e.created_at,e.preview_url,e.failure_reason,s.name AS sender_name
      FROM scheduled_emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1`, [job.data.emailId]).catch(() => null);
    if (updated?.rows[0]) await indexEmail(updated.rows[0]).catch(console.error);
  }
});
worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`));
worker.on('error', (error) => console.error('[worker] error', error));
console.log(`[worker] running with concurrency=${config.maxConcurrency}`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal}; draining active work`);
  await worker.close();
  await emailQueue.close();
  await pool.end();
  await redis.quit();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
