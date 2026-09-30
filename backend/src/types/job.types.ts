import { z } from "zod";

export type EmailJobResponse = {
  id: string;
  campaignId: string;
  recipientEmail: string;
  scheduledAt: string;
  status: string;
  attempts: number;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BullMQEmailJobData = {
  emailJobId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderId: string;
};

export const GetJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  campaignId: z.string().uuid().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});
