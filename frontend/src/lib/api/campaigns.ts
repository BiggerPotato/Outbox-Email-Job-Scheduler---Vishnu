import { apiClient } from './client';
import type { CampaignCreateRequest, TimelineEvent } from '@/types';

export async function createCampaign(payload: CampaignCreateRequest): Promise<any> {
  const { data } = await apiClient.post('/api/campaigns', payload);
  return data.campaign ?? data?.data?.campaign ?? data;
}

export async function getCampaignTimeline(campaignId: string): Promise<TimelineEvent[]> {
  try {
    const { data } = await apiClient.get(`/api/campaigns/${campaignId}/timeline`);
    const timeline = data?.timeline ?? data?.data?.timeline ?? data?.events ?? data?.data ?? data;
    if (Array.isArray(timeline?.events)) {
      return timeline.events.map((e: any) => ({
        type: e.type,
        at: e.at || e.timestamp || e.createdAt || new Date().toISOString(),
        detail: e.message || e.detail || e.type,
      }));
    }
    if (Array.isArray(timeline)) {
      return timeline.map((e: any) => ({
        type: e.type,
        at: e.at || e.timestamp || e.createdAt || new Date().toISOString(),
        detail: e.message || e.detail || e.type,
      }));
    }
    return [];
  } catch {
    return [];
  }
}
