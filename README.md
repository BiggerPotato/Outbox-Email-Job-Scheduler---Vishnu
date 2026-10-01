# ReachInbox Email Scheduler

Full-stack intern assignment implementation using a TypeScript/Express API, React + TypeScript dashboard, PostgreSQL, BullMQ/Redis, Elasticsearch, Google OAuth, Slack OAuth, and Ethereal fake SMTP. The UI schedules recipient lists, shows scheduled/sent/failed delivery, searches indexed email records, links Slack for rate-limit alerts, and exposes the authenticated BullMQ dashboard.

## Start locally

Requirements: Node.js 20+, Docker Desktop, and credentials for Google OAuth, Slack OAuth, and at least one Ethereal test sender.

1. Start Postgres, Redis, and Elasticsearch and wait for health checks:

   ```sh
   docker compose up -d --wait
   ```

2. Install workspace dependencies and copy `.env.example` to `.env`.

   ```sh
   npm install
   ```

3. Create an Ethereal account and paste the printed JSON object into `SMTP_SENDERS_JSON` in `.env`:

   ```sh
   npm run ethereal
   ```

   Repeat the command to make additional sender accounts. Keep these credentials private. Each sender object has its own `id`, `name`, SMTP `user`/`pass`, and `from` address. The API seeds these senders into PostgreSQL when it starts.

4. Create OAuth applications and set their credentials in `.env`:

   - **Google:** create an OAuth 2.0 Web client. Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI. Add your Google account as a test user if the consent screen is in testing mode.
   - **Slack:** create a Slack app, add `http://localhost:3000/auth/slack/callback` as an OAuth redirect URL, and grant bot scopes `chat:write` and `im:write`. Install the app into a workspace where you can verify the direct message.
   - Set stable random values for `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`.

5. Start the API, worker, and Vite dashboard:

   ```sh
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173) and sign in with Google. In production, build the client with `npm run build`, serve the generated client from the API, and run `npm start` and `npm run worker` as separate services with the same environment.

The provided PDF did not include a Figma URL, so the dashboard follows the assignment's product requirements with a clean responsive layout.

## Assignment requirements covered

- **Persistent scheduling:** PostgreSQL is the source of email state; BullMQ delayed jobs live in Redis. The Compose Redis service has AOF enabled and a named data volume. On API/worker startup, a reconciliation pass restores missing jobs from PostgreSQL. There is no cron job or in-memory scheduling timer.
- **Restart behavior and idempotency:** Jobs use the email UUID as the BullMQ job ID. A conditional PostgreSQL status transition (`scheduled` to `sending`) lets only one worker claim a message. Completed jobs are retained in Redis. Recovery only re-enqueues rows that are still `scheduled` and do not have a BullMQ job.
- **SMTP:** Each configured sender uses its own Ethereal SMTP credentials; the dashboard can schedule across multiple senders. Delivery preview URLs are available from the sent list.
- **Concurrency:** `WORKER_CONCURRENCY` configures each BullMQ worker process. Redis sender locks and slot allocation coordinate parallel jobs and multiple worker instances.
- **Minimum send spacing:** `MIN_DELAY_SECONDS` defaults to 2 seconds per sender. The worker reserves time slots atomically in Redis, then enforces the spacing again at send start. The compose form allows a campaign-specific delay; the sender's configured minimum always applies.
- **Hourly limits:** `MAX_EMAILS_PER_HOUR` caps each sender. A campaign can choose a lower `hourlyLimit`. Redis Lua atomically reserves both sender/hour and campaign/hour counters across workers. A job that reaches a full window is moved into the next hour rather than failed or dropped. This protects the configured sender cap and per-campaign cap during bursts such as 1,000 messages scheduled together.
- **Slack alerts:** Connect Slack from the dashboard using its OAuth flow. The bot token is encrypted in PostgreSQL with AES-256-GCM. At the first sender/campaign limit hit per sender per hour, the worker sends a real Slack DM; absent connections or Slack API failures do not stop email delivery. Disconnect removes the stored connection; reconnect works without a deploy.
- **Search:** PostgreSQL records are indexed in Elasticsearch and searchable from the dashboard by recipient, subject, or body. On API startup, the index is created if needed and rebuilt from Postgres. Email delivery remains authoritative if a later Elasticsearch status refresh fails.
- **Live queue:** `/api/admin/queues` serves Bull Board for authenticated users. It displays live BullMQ jobs and queue status.
- **Shared dashboard access:** Set `QUEUE_DASHBOARD_EMAILS` to a comma-separated list of Google accounts allowed to view the global queue. The regular dashboard remains user-scoped.
- **Google sign-in:** Google OAuth 2.0 verifies the ID token and verified email before creating the local user session. The dashboard shows the user's name, email, and Google avatar where available, with logout.
- **CSV/text upload:** The browser extracts and deduplicates email addresses from `.csv` and `.txt` files, displays the detected recipient count, and sends the batch to the scheduler API.

### SMTP exactly-once limitation

PostgreSQL and Redis prevent duplicate queue records and ensure only one worker claims a database row at a time. SMTP itself has no transactional idempotency key, so a process can crash after the SMTP server accepts a message but before the database records `sent`. The worker leaves such an uncertain row in `sending` and does not automatically resend it, favoring the assignment's no-duplicate constraint. An operator should inspect that row and the Ethereal inbox before manually resolving it. Ordinary SMTP errors are retried with BullMQ exponential backoff (up to five attempts).

## Environment

See `.env.example` for database, Redis, Elasticsearch, OAuth, sender, worker concurrency, minimum delay, and hourly limit settings. SMTP credentials and Slack OAuth tokens are encrypted in PostgreSQL with `TOKEN_ENCRYPTION_KEY`; keep that key stable and backed up or those stored credentials cannot be decrypted after restart. In production, use persistent managed services, TLS, network restrictions, backups, and unique secret values. Elasticsearch and Bull Board contain email data; keep them private and use the authenticated dashboard/API.

## API

All `/api` routes except `/api/health` and `/api/auth/me` require a Google-authenticated session.

### `POST /api/emails`

```json
{
  "recipients": ["person@example.com", "another@example.com"],
  "subject": "Following up",
  "body": "Hello, just checking in.",
  "senderId": "sender-1",
  "startAt": "2026-10-02T09:30:00.000Z",
  "delaySeconds": 2,
  "hourlyLimit": 100
}
```

The start must be at least 30 seconds in the future. A batch can contain up to 5,000 unique valid email addresses. The hourly limit can be lower than or equal to that sender's configured maximum. The response includes a campaign ID and one scheduled record per recipient. Validation errors return `400` with field messages.

### Other routes

- `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/senders`
- `GET /api/emails?state=scheduled|sent|failed|cancelled|all&limit=100&q=term`
- `GET /api/emails/summary`
- `DELETE /api/emails/:id` (scheduled emails only)
- `GET /api/slack/status`, `DELETE /api/slack/connection`
- `GET /api/health`
- `/api/admin/queues` (Bull Board; requires login)

## Structure

```text
server/src/      TypeScript API, OAuth, PostgreSQL, indexing, queue, and worker
client/src/      React + TypeScript dashboard and reusable UI pieces
docker-compose.yml  Local Postgres, Redis, Elasticsearch
```
