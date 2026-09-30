import axios from 'axios';

/** getApiErrorMessage helper. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.error?.message ??
      error.response?.data?.message ??
      error.message;
    if (message) return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
