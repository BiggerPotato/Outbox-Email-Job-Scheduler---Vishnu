import { z } from "zod";

export type CreateCampaignDTO = {
  subject: string;
  body: string;
  senderId: string;
  recipients: string[];
  scheduledStartAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
};

export type UpdateCampaignDTO = Partial<CreateCampaignDTO>;

export type CampaignResponse = {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  scheduledStartAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignWithJobsResponse = CampaignResponse & {
  jobs: EmailJobSummary[];
};

export type CampaignTimelineEventType =
  | "campaign_created"
  | "campaign_scheduled"
  | "job_scheduled"
  | "job_sending"
  | "job_sent"
  | "job_failed"
  | "rate_limited"
  | "job_retry";

export type CampaignTimelineEvent = {
  id: string;
  type: CampaignTimelineEventType;
  message: string;
  at: string;
  meta?: Record<string, unknown>;
};

export type CampaignTimelineResponse = {
  campaignId: string;
  events: CampaignTimelineEvent[];
};

export type EmailJobSummary = {
  id: string;
  recipientEmail: string;
  scheduledAt: string;
  status: string;
  sentAt?: string | null;
};

export type RecipientStats = {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
};

const recipientSchema = z.string().email();

export const CreateCampaignSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  senderId: z.string().uuid(),
  recipients: z.array(recipientSchema).min(1),
  scheduledStartAt: z.string().datetime(),
  delayBetweenEmails: z.coerce.number().int().min(1000),
  hourlyLimit: z.coerce.number().int().min(1)
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial();

export const GetCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  senderId: z.string().uuid().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});
