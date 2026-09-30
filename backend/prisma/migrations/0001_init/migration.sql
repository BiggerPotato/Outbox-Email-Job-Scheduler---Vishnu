CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED');
CREATE TYPE "JobStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'RESCHEDULED');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "googleId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sender" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailCampaign" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "scheduledStartAt" TIMESTAMP(3) NOT NULL,
  "delayBetweenEmails" INTEGER NOT NULL,
  "hourlyLimit" INTEGER NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'SCHEDULED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitWindow" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "senderId" UUID NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_googleId_idx" ON "User"("googleId");
CREATE INDEX "User_email_idx" ON "User"("email");

CREATE INDEX "Sender_userId_idx" ON "Sender"("userId");
CREATE INDEX "Sender_email_idx" ON "Sender"("email");

CREATE INDEX "EmailCampaign_userId_idx" ON "EmailCampaign"("userId");
CREATE INDEX "EmailCampaign_senderId_idx" ON "EmailCampaign"("senderId");
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE INDEX "EmailCampaign_scheduledStartAt_idx" ON "EmailCampaign"("scheduledStartAt");

CREATE INDEX "EmailJob_campaignId_idx" ON "EmailJob"("campaignId");
CREATE INDEX "EmailJob_status_idx" ON "EmailJob"("status");
CREATE INDEX "EmailJob_scheduledAt_idx" ON "EmailJob"("scheduledAt");
CREATE INDEX "EmailJob_recipientEmail_idx" ON "EmailJob"("recipientEmail");

CREATE UNIQUE INDEX "RateLimitWindow_senderId_windowStart_key" ON "RateLimitWindow"("senderId", "windowStart");
CREATE INDEX "RateLimitWindow_senderId_idx" ON "RateLimitWindow"("senderId");
CREATE INDEX "RateLimitWindow_windowStart_idx" ON "RateLimitWindow"("windowStart");

ALTER TABLE "Sender"
  ADD CONSTRAINT "Sender_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign"
  ADD CONSTRAINT "EmailCampaign_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign"
  ADD CONSTRAINT "EmailCampaign_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailJob"
  ADD CONSTRAINT "EmailJob_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RateLimitWindow"
  ADD CONSTRAINT "RateLimitWindow_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
