import type { Campaign } from './campaign';
import type { Job } from './job';
import type { Sender } from './sender';
import type { User } from './user';

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CampaignCreateRequest {
  subject: string;
  body: string;
  senderId: string;
  scheduledStartAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  recipients: string[];
}

export interface CampaignsResponse {
  campaigns: Campaign[];
}

export interface JobsResponse {
  jobs: Job[];
}

export interface SendersResponse {
  senders: Sender[];
}

export interface ConfigResponse {
  config: Record<string, unknown>;
}
