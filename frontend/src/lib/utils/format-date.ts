import { format } from 'date-fns';

/** formatJobTime helper. */
export function formatJobTime(value?: string) {
  if (!value) return '-';
  return format(new Date(value), 'MMM dd, yyyy p');
}
