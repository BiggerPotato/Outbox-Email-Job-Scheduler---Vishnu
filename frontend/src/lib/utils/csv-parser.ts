import Papa from 'papaparse';
import { isValidEmail } from '@/lib/utils/validate-email';

export interface CsvParseResult {
  valid: string[];
  invalid: string[];
  duplicates: number;
}

/** parseCsvText helper. */
export function parseCsvText(text: string): CsvParseResult {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const values = parsed.data.flat().map((value) => value.trim());
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const value of values) {
    if (!value) continue;
    if (!isValidEmail(value)) {
      invalid.push(value);
      continue;
    }
    if (seen.has(value.toLowerCase())) {
      duplicates += 1;
      continue;
    }
    seen.add(value.toLowerCase());
    valid.push(value);
  }

  return { valid, invalid, duplicates };
}
