import { apiClient } from './client';

export interface CsvValidationResult {
  total: number;
  valid: string[];
  invalid: string[];
  duplicates: number;
}

export async function validateCsvFile(file: File): Promise<CsvValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/api/csv/validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.data ?? data;
}
