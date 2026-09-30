export const AUTH_TOKEN_KEY = 'outbox.jwt';

export function getAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  return token || undefined;
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}
