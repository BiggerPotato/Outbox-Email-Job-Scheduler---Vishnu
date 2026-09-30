export type CampaignTimelineEventType =
  | 'campaign_created'
  | 'campaign_scheduled'
  | 'job_scheduled'
  | 'job_sending'
  | 'job_sent'
  | 'job_failed'
  | 'rate_limited'
  | 'job_retry';

export interface CampaignTimelineEvent {
  id: string;
  type: CampaignTimelineEventType;
  message: string;
  at: string;
  meta?: Record<string, unknown>;
}

export interface CampaignTimelineResponse {
  campaignId: string;
  events: CampaignTimelineEvent[];
}
