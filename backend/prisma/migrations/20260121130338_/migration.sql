/*
  Warnings:

  - The primary key for the `EmailCampaign` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `EmailJob` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RateLimitWindow` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Sender` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."EmailCampaign" DROP CONSTRAINT "EmailCampaign_senderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmailCampaign" DROP CONSTRAINT "EmailCampaign_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmailJob" DROP CONSTRAINT "EmailJob_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RateLimitWindow" DROP CONSTRAINT "RateLimitWindow_senderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sender" DROP CONSTRAINT "Sender_userId_fkey";

-- AlterTable
ALTER TABLE "public"."EmailCampaign" DROP CONSTRAINT "EmailCampaign_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "senderId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."EmailJob" DROP CONSTRAINT "EmailJob_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "campaignId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."RateLimitWindow" DROP CONSTRAINT "RateLimitWindow_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "senderId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Sender" DROP CONSTRAINT "Sender_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "Sender_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "public"."Sender" ADD CONSTRAINT "Sender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailCampaign" ADD CONSTRAINT "EmailCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailCampaign" ADD CONSTRAINT "EmailCampaign_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."Sender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailJob" ADD CONSTRAINT "EmailJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RateLimitWindow" ADD CONSTRAINT "RateLimitWindow_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."Sender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
