import { apiClient } from './client';
import type { Job, JobStatus, PaginatedJobs } from '@/types';

function normalizeJob(raw: any): Job {
  const statusMap: Record<string, JobStatus> = {
    SCHEDULED: 'scheduled',
    RESCHEDULED: 'rescheduled',
    SENDING: 'sending',
    SENT: 'sent',
    FAILED: 'failed',
    CANCELED: 'canceled',
  };

  return {
    id: raw.id,
    email: raw.email ?? raw.recipientEmail ?? '',
    subject: raw.subject ?? raw.campaign?.subject ?? '',
    scheduledAt: raw.scheduledAt,
    sentAt: raw.sentAt,
    status: statusMap[String(raw.status).toUpperCase()] ?? (raw.status as JobStatus) ?? 'scheduled',
    campaignId: raw.campaignId,
    attempts: raw.attempts ?? raw.attemptsMade ?? 0,
    lastError: raw.lastError ?? null,
  };
}

function extractPaginatedJobs(data: any): PaginatedJobs {
  if (Array.isArray(data)) {
    const jobs = data.map(normalizeJob);
    return { jobs, total: jobs.length, page: 1, limit: jobs.length, totalPages: 1 };
  }
  const source = data?.jobs ?? data?.data?.jobs ?? data?.data ?? [];
  const jobs = Array.isArray(source) ? source.map(normalizeJob) : [];
  const total = data?.total ?? data?.data?.total ?? jobs.length;
  const page = data?.page ?? data?.data?.page ?? 1;
  const limit = data?.limit ?? data?.data?.limit ?? 20;
  const totalPages = data?.totalPages ?? data?.data?.totalPages ?? Math.max(Math.ceil(total / limit), 1);

  return { jobs, total, page, limit, totalPages };
}

export async function listScheduledJobs(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedJobs> {
  const { data } = await apiClient.get('/api/jobs/scheduled', { params });
  return extractPaginatedJobs(data);
}

export async function listSentJobs(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedJobs> {
  const queryParams: Record<string, string | number> = {};
  if (params?.status && params.status !== 'all') queryParams.status = params.status;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get('/api/jobs/sent', {
    params: Object.keys(queryParams).length ? queryParams : undefined,
  });
  return extractPaginatedJobs(data);
}

export async function cancelJob(jobId: string): Promise<void> {
  await apiClient.delete(`/api/jobs/${jobId}`);
}
