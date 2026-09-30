const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** isValidEmail helper. */
export function isValidEmail(email: string) {
  return emailRegex.test(email.trim());
}
