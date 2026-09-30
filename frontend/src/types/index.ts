export type JobStatus = 'scheduled' | 'rescheduled' | 'sending' | 'sent' | 'failed' | 'canceled';

export interface Job {
  id: string;
  email: string;
  subject: string;
  scheduledAt?: string;
  sentAt?: string;
  campaignId?: string;
  status: JobStatus;
  attempts?: number;
  lastError?: string | null;
}

export interface PaginatedJobs {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface CampaignCreateRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledStartAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export type TimelineEventType =
  | 'campaign_created'
  | 'campaign_scheduled'
  | 'job_scheduled'
  | 'job_sending'
  | 'job_sent'
  | 'job_failed'
  | 'rate_limited'
  | 'job_retry';

export interface TimelineEvent {
  type: TimelineEventType;
  at: string;
  detail: string;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}
