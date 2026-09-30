export interface ComposeDefaults {
  delayBetweenEmails: number;
  hourlyLimit: number;
  defaultSenderId?: string;
  scheduledTime?: string;
}

const DEFAULTS_KEY = 'outbox.compose.defaults';

/** getComposeDefaults helper. */
export function getComposeDefaults(): ComposeDefaults | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DEFAULTS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ComposeDefaults;
  } catch {
    return null;
  }
}

/** saveComposeDefaults helper. */
export function saveComposeDefaults(defaults: ComposeDefaults) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
}
