import { apiClient } from './client';
import type { Sender } from '@/types';

function normalizeSender(raw: any): Sender {
  return {
    id: raw.id,
    name: raw.name ?? raw.displayName ?? '',
    email: raw.email,
    createdAt: raw.createdAt,
  };
}

export async function listSenders(): Promise<Sender[]> {
  const { data } = await apiClient.get('/api/senders');
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.senders)
    ? data.senders
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.data?.senders)
    ? data.data.senders
    : [];
  return items.map(normalizeSender);
}

export async function createSender(payload: { name: string; email: string }): Promise<Sender> {
  const { data } = await apiClient.post('/api/senders', {
    displayName: payload.name,
    email: payload.email,
  });
  const sender = data.sender ?? data?.data ?? data;
  return normalizeSender(sender);
}

export async function deleteSender(senderId: string): Promise<void> {
  await apiClient.delete(`/api/senders/${senderId}`);
}
