import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { config, validateConfig } from './config.js';
import { initializeDatabase, pool } from './db.js';
import { emailQueue, redis } from './redis.js';
import { ensureEmailIndex, elastic, indexEmail, indexEmails, removeEmailFromIndex } from './email-index.js';
import { decrypt, encrypt, requireUser } from './security.js';
import { reconcileScheduledJobs } from './reconcile.js';

validateConfig();
const app = express();
const PgSession = connectPgSimple(session);
const google = new OAuth2Client(config.googleClientId, config.googleClientSecret, config.googleCallbackUrl);
const here = path.dirname(fileURLToPath(import.meta.url));

const requireQueueAdmin: express.RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.userId || config.queueDashboardEmails.length === 0) return res.status(403).send('Queue dashboard access is not configured. Set QUEUE_DASHBOARD_EMAILS for authorized Google accounts.');
    const user = await pool.query('SELECT email FROM users WHERE id=$1', [req.session.userId]);
    if (!user.rowCount || !config.queueDashboardEmails.includes(String(user.rows[0].email).toLowerCase())) return res.status(403).send('Your account is not allowed to view the shared queue dashboard.');
    next();
  } catch (error) { next(error); }
};

app.disable('x-powered-by');
if (config.isProduction) app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(session({
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: config.sessionSecret, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProduction, maxAge: 7 * 86400000 },
}));

const queueAdapter = new ExpressAdapter();
queueAdapter.setBasePath('/api/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: queueAdapter });
app.use('/api/admin/queues', requireQueueAdmin, queueAdapter.getRouter());

app.get('/auth/google', (req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) return res.status(503).send('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.');
  const state = randomUUID();
  req.session.googleState = state;
  res.redirect(google.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, prompt: 'select_account' }));
});

app.get('/auth/google/callback', async (req, res, next) => {
  try {
    if (!req.query.code || !req.query.state || req.query.state !== req.session.googleState) return res.status(400).send('Invalid Google OAuth state.');
    delete req.session.googleState;
    const { tokens } = await google.getToken(String(req.query.code));
    if (!tokens.id_token) return res.status(401).send('Google did not return an ID token.');
    const ticket = await google.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) return res.status(401).send('A verified Google account is required.');
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [profile.email]);
    const userId = existing.rows[0]?.id ?? randomUUID();
    await pool.query(`INSERT INTO users (id,email,name,avatar_url) VALUES ($1,$2,$3,$4)
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,avatar_url=EXCLUDED.avatar_url`, [userId, profile.email, profile.name ?? profile.email, profile.picture ?? null]);
    const saved = await pool.query('SELECT id FROM users WHERE email=$1', [profile.email]);
    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.userId = saved.rows[0].id as string;
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    res.redirect(config.clientOrigin);
  } catch (error) { next(error); }
});

app.get('/auth/slack', requireUser, (req, res) => {
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) return res.status(503).send('Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET to enable Slack connection.');
  const state = randomUUID();
  req.session.slackState = state;
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', process.env.SLACK_CLIENT_ID);
  url.searchParams.set('scope', 'chat:write,im:write');
  url.searchParams.set('redirect_uri', config.slackCallbackUrl);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/auth/slack/callback', requireUser, async (req, res, next) => {
  try {
    if (req.query.error) return res.redirect(`${config.clientOrigin}?slack=cancelled`);
    if (!req.query.code || req.query.state !== req.session.slackState) return res.status(400).send('Invalid Slack OAuth state.');
    delete req.session.slackState;
    const body = new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET!, code: String(req.query.code), redirect_uri: config.slackCallbackUrl });
    const response = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const oauth = await response.json() as { ok: boolean; access_token?: string; team?: { id: string; name: string }; authed_user?: { id: string }; error?: string };
    if (!oauth.ok || !oauth.access_token || !oauth.team?.id || !oauth.authed_user?.id) return res.status(502).send(`Slack authorization failed: ${oauth.error ?? 'incomplete response'}`);
    await pool.query(`INSERT INTO slack_connections (user_id,team_id,team_name,slack_user_id,access_token)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO UPDATE SET team_id=EXCLUDED.team_id,team_name=EXCLUDED.team_name,
      slack_user_id=EXCLUDED.slack_user_id,access_token=EXCLUDED.access_token,connected_at=now()`,
      [req.session.userId, oauth.team.id, oauth.team.name ?? 'Slack workspace', oauth.authed_user.id, encrypt(oauth.access_token)]);
    res.redirect(`${config.clientOrigin}?slack=connected`);
  } catch (error) { next(error); }
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const result = await pool.query(`SELECT u.id,u.name,u.email,u.avatar_url,
      EXISTS(SELECT 1 FROM slack_connections s WHERE s.user_id=u.id) AS slack_connected
      FROM users u WHERE u.id=$1`, [req.session.userId]);
    if (!result.rowCount) { req.session.destroy(() => {}); return res.json({ user: null }); }
    res.json({ user: { id: result.rows[0].id, name: result.rows[0].name, email: result.rows[0].email, avatar: result.rows[0].avatar_url, slackConnected: result.rows[0].slack_connected } });
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', (req, res) => req.session.destroy((error) => error ? res.status(500).json({ error: 'Could not log out.' }) : res.clearCookie('connect.sid').json({ ok: true })));

app.get('/api/senders', requireUser, async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT id,name,max_per_hour,min_delay_seconds FROM senders WHERE enabled=true ORDER BY name');
    res.json({ senders: result.rows.map((row) => ({ id: row.id, name: row.name, maxPerHour: row.max_per_hour, minDelaySeconds: row.min_delay_seconds })) });
  } catch (error) { next(error); }
});

app.post('/api/emails', requireUser, async (req, res, next) => {
  try {
    const { recipients, subject, body, senderId, startAt, delaySeconds, hourlyLimit } = req.body ?? {};
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : '';
    const senderResult = await pool.query('SELECT id,name,max_per_hour,min_delay_seconds FROM senders WHERE id=$1 AND enabled=true', [senderId]);
    const start = new Date(startAt);
    const delay = Number(delaySeconds);
    const hourly = Number(hourlyLimit);
    const errors: Record<string, string> = {};
    if (!senderResult.rowCount) errors.senderId = 'Select an available sender.';
    if (!Array.isArray(recipients) || recipients.length < 1 || recipients.length > 5000) errors.recipients = 'Upload between 1 and 5,000 email addresses.';
    if (Array.isArray(recipients) && recipients.some((email) => typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) errors.recipients = 'One or more email addresses are invalid.';
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200) errors.subject = 'Subject is required and must be 200 characters or fewer.';
    if (typeof body !== 'string' || !body.trim() || body.length > 10000) errors.body = 'Message is required and must be 10,000 characters or fewer.';
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() + 30000) errors.startAt = 'Choose a start time at least 30 seconds in the future.';
    if (!Number.isInteger(delay) || delay < 0 || delay > 3600) errors.delaySeconds = 'Delay must be from 0 to 3,600 seconds.';
    if (!Number.isInteger(hourly) || hourly < 1 || hourly > (senderResult.rows[0]?.max_per_hour ?? config.maxEmailsPerHour)) errors.hourlyLimit = `Hourly limit must be from 1 to ${senderResult.rows[0]?.max_per_hour ?? config.maxEmailsPerHour}.`;
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) errors.idempotencyKey = 'A valid idempotency key is required.';
    if (errors.recipients === undefined && Array.isArray(recipients)) {
      const unique = new Set(recipients.map((email: string) => email.trim().toLowerCase()));
      if (unique.size !== recipients.length) errors.recipients = 'Duplicate recipients were found. Remove duplicates before scheduling.';
    }
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });

    const campaignId = randomUUID();
    const normalized = (recipients as string[]).map((email) => email.trim().toLowerCase());
    const records = normalized.map((recipient, index) => ({
      id: randomUUID(), recipient, campaignId,
      scheduledAt: new Date(start.getTime() + index * delay * 1000 + Math.floor(index / hourly) * 3600000),
    }));
    const client = await pool.connect();
    let duplicateCampaign = false;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(`INSERT INTO email_campaigns (id,user_id,idempotency_key) VALUES ($1,$2,$3)
        ON CONFLICT (user_id,idempotency_key) DO NOTHING RETURNING id`, [campaignId, req.session.userId, idempotencyKey]);
      if (!inserted.rowCount) {
        await client.query('ROLLBACK');
        duplicateCampaign = true;
      } else {
      for (const row of records) await client.query(`INSERT INTO scheduled_emails
        (id,user_id,sender_id,recipient,subject,body,campaign_id,campaign_hourly_limit,scheduled_at,queue_job_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$1)`, [row.id, req.session.userId, senderId, row.recipient, subject.trim(), body, campaignId, hourly, row.scheduledAt]);
      await client.query('COMMIT');
      }
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }

    if (duplicateCampaign) {
      const previous = await pool.query('SELECT id FROM email_campaigns WHERE user_id=$1 AND idempotency_key=$2', [req.session.userId, idempotencyKey]);
      await reconcileScheduledJobs();
      const rows = await pool.query('SELECT id,recipient,scheduled_at FROM scheduled_emails WHERE campaign_id=$1 ORDER BY scheduled_at', [previous.rows[0].id]);
      return res.status(200).json({ campaignId: previous.rows[0].id, count: rows.rowCount, scheduled: rows.rows.map((row) => ({ id: row.id, recipient: row.recipient, scheduledAt: row.scheduled_at })) });
    }

    try {
      for (const row of records) {
        await emailQueue.add('send-email', { emailId: row.id, senderId, campaignId, campaignHourlyLimit: hourly, scheduledAt: row.scheduledAt.toISOString() }, {
          jobId: row.id, delay: Math.max(0, row.scheduledAt.getTime() - Date.now()),
        });
      }
    } catch (error) {
      // Keep the Postgres rows and any already-added BullMQ jobs. A retry with the
      // same idempotency key or a process restart will reconcile the remaining jobs.
      console.error(`[api] queue hand-off incomplete for campaign ${campaignId}; recovery will reconcile it`, error);
      throw error;
    }
    const indexRows = await pool.query(`SELECT e.id,e.user_id,e.sender_id,e.recipient,e.subject,e.body,e.status,e.scheduled_at,e.sent_at,e.created_at,e.preview_url,e.failure_reason,s.name AS sender_name
      FROM scheduled_emails e JOIN senders s ON s.id=e.sender_id WHERE e.campaign_id=$1`, [campaignId]);
    await indexEmails(indexRows.rows).catch((error) => console.error(`[api] Elasticsearch indexing will be repaired on startup: ${(error as Error).message}`));
    res.status(201).json({ campaignId, count: records.length, scheduled: records.map((row) => ({ id: row.id, recipient: row.recipient, scheduledAt: row.scheduledAt })) });
  } catch (error) { next(error); }
});

app.get('/api/emails', requireUser, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit ?? 100), 10) || 100));
    const state = String(req.query.state ?? 'all');
    const q = String(req.query.q ?? '').trim();
    const validStates = ['scheduled', 'sent', 'failed', 'cancelled', 'all'];
    if (!validStates.includes(state)) return res.status(400).json({ error: 'Invalid email status filter.' });
    if (q) {
      const result = await elastic.search({ index: config.elasticIndex, size: limit, query: {
        bool: { must: [{ multi_match: { query: q, type: 'bool_prefix', fields: ['recipient','recipient._2gram','recipient._3gram','subject','subject._2gram','subject._3gram','body'] } }],
          filter: [{ term: { userId: req.session.userId } }, ...(state === 'all' ? [] : [{ term: { status: state } }])] },
      }, sort: [{ createdAt: 'desc' }] });
      const emails = result.hits.hits.map((hit) => hit._source);
      return res.json({ emails, count: emails.length });
    }
    const result = await pool.query(`SELECT e.id,e.recipient,e.subject,e.status,e.scheduled_at,e.sent_at,e.attempts,e.failure_reason,e.preview_url,e.created_at,s.name AS sender_name
      FROM scheduled_emails e JOIN senders s ON s.id=e.sender_id
      WHERE e.user_id=$1 AND ($2='all' OR ($2='scheduled' AND e.status IN ('scheduled','sending')) OR e.status=$2)
      ORDER BY e.created_at DESC LIMIT $3`, [req.session.userId, state, limit]);
    res.json({ emails: result.rows.map((row) => ({ id: row.id, recipient: row.recipient, subject: row.subject, status: row.status,
      scheduledAt: row.scheduled_at, sentAt: row.sent_at, attempts: row.attempts, error: row.failure_reason, previewUrl: row.preview_url,
      createdAt: row.created_at, senderName: row.sender_name })), count: result.rowCount });
  } catch (error) { next(error); }
});

app.get('/api/emails/summary', requireUser, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT status,count(*)::int AS count FROM scheduled_emails WHERE user_id=$1 GROUP BY status', [req.session.userId]);
    res.json({ counts: Object.fromEntries(result.rows.map((row) => [row.status, row.count])) });
  } catch (error) { next(error); }
});

app.delete('/api/emails/:id', requireUser, async (req, res, next) => {
  try {
    const emailId = req.params.id;
    if (typeof emailId !== 'string') return res.status(400).json({ error: 'Invalid email id.' });
    const found = await pool.query('SELECT status FROM scheduled_emails WHERE id=$1 AND user_id=$2', [emailId, req.session.userId]);
    if (!found.rowCount) return res.status(404).json({ error: 'Email not found.' });
    if (found.rows[0].status !== 'scheduled') return res.status(409).json({ error: `This email cannot be cancelled while it is ${found.rows[0].status}.` });
    const job = await emailQueue.getJob(emailId);
    if (job) {
      const queueState = await job.getState();
      if (!['delayed', 'waiting', 'paused'].includes(queueState)) return res.status(409).json({ error: 'Email delivery has already started.' });
      await job.remove();
    }
    await pool.query(`UPDATE scheduled_emails SET status='cancelled',updated_at=now() WHERE id=$1`, [emailId]);
    await removeEmailFromIndex(emailId);
    const updated = await pool.query('SELECT * FROM scheduled_emails WHERE id=$1', [emailId]);
    await indexEmail(updated.rows[0]);
    res.json({ cancelled: true, id: emailId });
  } catch (error) { next(error); }
});

app.get('/api/slack/status', requireUser, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT team_name,connected_at FROM slack_connections WHERE user_id=$1', [req.session.userId]);
    res.json({ connected: Boolean(result.rowCount), teamName: result.rows[0]?.team_name ?? null, connectedAt: result.rows[0]?.connected_at ?? null });
  } catch (error) { next(error); }
});
app.delete('/api/slack/connection', requireUser, async (req, res, next) => {
  try {
    const saved = await pool.query('SELECT access_token FROM slack_connections WHERE user_id=$1', [req.session.userId]);
    if (saved.rowCount) {
      try {
        const response = await fetch('https://slack.com/api/auth.revoke', { method: 'POST', headers: { Authorization: `Bearer ${decrypt(saved.rows[0].access_token)}` } });
        const result = await response.json() as { ok: boolean; error?: string };
        if (!result.ok) console.warn(`[api] Slack token revoke returned ${result.error ?? response.status}; removing local connection anyway`);
      } catch (error) { console.warn(`[api] Could not reach Slack to revoke; removing local connection: ${(error as Error).message}`); }
    }
    await pool.query('DELETE FROM slack_connections WHERE user_id=$1', [req.session.userId]);
    res.json({ disconnected: true });
  }
  catch (error) { next(error); }
});

app.get('/api/health', async (_req, res) => {
  try {
    const [db, queue, search] = await Promise.all([pool.query('SELECT 1'), redis.ping(), elastic.ping()]);
    res.json({ status: 'ok', postgres: db.rowCount === 1, redis: queue === 'PONG', elasticsearch: search });
  } catch { res.status(503).json({ status: 'unavailable' }); }
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api]', error);
  res.status(500).json({ error: 'The server could not complete that request.' });
});

const clientDist = path.resolve(here, '../../client/dist');
app.use(express.static(clientDist));
app.get('*path', async (_req, res, next) => {
  try { res.type('html').send(await readFile(path.join(clientDist, 'index.html'))); }
  catch { next(); }
});

await initializeDatabase();
await reconcileScheduledJobs();
await ensureEmailIndex();
const server = app.listen(config.port, () => console.log(`[api] listening on ${config.apiOrigin}; Bull Board at /api/admin/queues`));

async function shutdown(signal: string) {
  console.log(`[api] ${signal}; shutting down`);
  server.close(async () => { await emailQueue.close(); await pool.end(); await redis.quit(); process.exit(0); });
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
