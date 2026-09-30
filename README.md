# ReachInbox-Style Email Scheduler

A production-grade email scheduling service with a dashboard, supporting delayed sends, rate limiting, persistence across restarts, and Google OAuth authentication.

## Demo Video

Demo video (5 minutes): https://youtu.be/2ZDRbzHzl0M

The video demonstrates scheduling emails, viewing scheduled and sent emails, restart persistence, and rate limiting behavior.

## Features Overview

- Google OAuth login (no passwords stored)
- Email scheduling using BullMQ delayed jobs (no cron)
- Persistent job storage across restarts
- Multiple senders support
- Per-sender hourly rate limiting (Redis-backed)
- Configurable worker concurrency and send delays
- Idempotent job processing
- Scheduled and sent email dashboards
- CSV upload with validation and de-duplication
- Fake SMTP delivery using Ethereal Email

## Tech Stack

Backend
- TypeScript
- Express.js
- PostgreSQL + Prisma
- BullMQ + Redis
- Nodemailer (Ethereal SMTP)
- Zod (validation)
- Pino (logging)

Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

Infrastructure
- Docker & Docker Compose (Postgres, Redis)

## Architecture Overview

The API server handles authentication, campaign creation, and job persistence. Jobs are stored in PostgreSQL and scheduled using BullMQ delayed jobs. Redis backs BullMQ and rate-limit counters. The worker runs as a separate process and sends emails via SMTP. The frontend communicates with backend APIs using a JWT obtained after Google OAuth.

Flow:
Frontend -> API (Express) -> PostgreSQL
                     -> BullMQ (Redis) -> Worker -> Ethereal SMTP

## Persistence & Restart Safety

Delayed jobs are stored in Redis by BullMQ. Job state is stored in PostgreSQL. On restart, workers resume pending jobs without duplication. Idempotency is enforced using database status transitions and BullMQ `jobId = EmailJob.id`.

## Rate Limiting & Concurrency

Per-sender hourly rate limits are enforced using Redis with a sliding 1-hour window. When the limit is exceeded, jobs are rescheduled rather than dropped. Order is preserved using calculated delays. Worker concurrency is configurable via environment variables, and a minimum delay between sends simulates provider throttling. The trade-off is that large backlogs can push schedules beyond the next hour window.

## Local Setup Instructions

Prerequisites
- Node.js 18+
- Docker + Docker Compose
- npm

Default ports
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

Backend setup
1. `cd backend`
2. `cp .env.example .env`
3. `docker compose -f docker-compose.yml up -d`
4. `npm install`
5. `npm run prisma:migrate`

Start services
- `npm run dev`   # API
- `npm run worker` # Worker (separate terminal)

The worker must be running for emails to be sent.

Frontend setup
1. `cd frontend`
2. `cp .env.example .env.local`
3. `npm install`
4. `npm run dev`

## Environment Configuration

Secrets are provided via local environment files and are not committed. Use placeholders where required.

Backend (Required)
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `FRONTEND_URL`

Google OAuth (Required)
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`

Required variables:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

Users sign in with their own Google account. The app never stores passwords.

Ethereal Email (Required)
- Ethereal is a fake SMTP service.
- Emails are not delivered to real inboxes.
- Preview URLs are logged by the worker.

Required variables:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Frontend (Required)
- `NEXT_PUBLIC_BACKEND_URL`

Frontend (Optional, only if NextAuth is enabled)
- `NEXT_PUBLIC_API_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## API Overview (High-Level)

Auth
- `/api/auth/*`

Campaigns
- `/api/campaigns/*`

Jobs (scheduled / sent)
- `/api/jobs/scheduled`
- `/api/jobs/sent`
- `/api/jobs/:id` (DELETE)

Senders
- `/api/senders/*`

CSV validation
- `/api/csv/validate`

Health endpoints
- `/api/health`
- `/api/health/detailed`
- `/api/config`

## Troubleshooting

- Redis ECONNREFUSED -> Docker not running
- Prisma P1001 -> Postgres not reachable
- 401 AUTH_MISSING -> Missing Bearer token
- Email not received -> Ethereal is fake SMTP
- Jobs stuck -> Worker not running

## Deployment Notes

Backend and worker should run as separate processes. Use managed PostgreSQL and Redis in production. Update Google OAuth redirect URIs for deployed domains. Scale workers horizontally if needed.

## Assumptions & Trade-offs

- Rate limiting is per sender (not global).
- Ethereal is used only for testing.
- Focus is correctness and persistence, not bulk throughput.
