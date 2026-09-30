export interface ComposeDraft {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  scheduledDate: string;
  scheduledTime: string;
}

const DRAFT_KEY = 'outbox.compose.draft';

/** getComposeDraft helper. */
export function getComposeDraft(): ComposeDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ComposeDraft;
  } catch {
    return null;
  }
}

/** saveComposeDraft helper. */
export function saveComposeDraft(draft: Partial<ComposeDraft>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/** clearComposeDraft helper. */
export function clearComposeDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRAFT_KEY);
}
