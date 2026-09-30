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
