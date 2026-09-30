const STORAGE_KEY = 'outbox.hidden.jobs';

/** getHiddenJobs helper. */
export function getHiddenJobs(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** hideJob helper. */
export function hideJob(jobId: string) {
  if (typeof window === 'undefined') return;
  const current = new Set(getHiddenJobs());
  current.add(jobId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
}

/** showJob helper. */
export function showJob(jobId: string) {
  if (typeof window === 'undefined') return;
  const current = new Set(getHiddenJobs());
  current.delete(jobId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
}

/** clearHiddenJobs helper. */
export function clearHiddenJobs() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
