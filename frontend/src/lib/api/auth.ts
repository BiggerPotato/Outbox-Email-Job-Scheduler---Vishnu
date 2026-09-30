import { apiClient } from './client';
import type { User } from '@/types';

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get('/api/auth/me');
  return data.user ?? data?.data?.user ?? data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout');
  } catch {
    // Ignore backend logout errors, local storage will be cleared
  }
}
