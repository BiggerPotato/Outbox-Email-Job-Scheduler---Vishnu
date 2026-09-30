import axios from 'axios';
import { clearAuthToken, getAuthToken } from '@/lib/auth/token';

export const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      clearAuthToken();
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);
