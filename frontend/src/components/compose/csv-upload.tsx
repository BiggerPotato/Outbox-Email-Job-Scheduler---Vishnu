'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { parseCsvText } from '@/lib/utils/csv-parser';
import { cn } from '@/lib/utils/cn';

interface CsvUploadProps {
  onParsed: (emails: string[], invalid: string[], duplicates: number) => void;
}

/** Render the CsvUpload component. */
export default function CsvUpload({ onParsed }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = parseCsvText(text);
      onParsed(result.valid, result.invalid, result.duplicates);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full items-center justify-between rounded-2xl border border-dashed border-border bg-white px-4 py-3 text-sm transition hover:bg-white'
        )}
      >
        <span className="text-muted-foreground">
          {fileName ? fileName : 'Upload List (CSV)'}
        </span>
        <span className="flex items-center gap-2 text-primary">
          <Upload className="h-4 w-4" />
          Upload
        </span>
      </button>
    </div>
  );
}

