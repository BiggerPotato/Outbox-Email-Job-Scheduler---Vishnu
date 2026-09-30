/** copyToClipboard helper. */
export async function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined') return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
