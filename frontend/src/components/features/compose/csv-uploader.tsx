'use client';

import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { parseCsvText, type CsvParseResult } from '@/lib/utils/csv-parser';

interface CsvUploaderProps {
  onParsed: (result: CsvParseResult) => void;
}

/** Render the CsvUploader component. */
export default function CsvUploader({ onParsed }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = parseCsvText(text);
      onParsed(result);
    };
    reader.readAsText(file);
  };

  return (
    <div
      className={cn(
        'flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-white p-6 text-center transition-all',
        isDragging && 'border-[#7b1b5a] bg-[#f7e9f1]'
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Upload className="h-10 w-10 text-muted-foreground/70" />
      <div>
        <p className="text-sm font-medium text-foreground">Drag & drop CSV</p>
        <p className="text-xs text-muted-foreground">
          {fileName ? 'CSV ready to parse' : 'or browse your recipient list'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-medium text-foreground transition hover:border-gray-300"
      >
        Browse CSV
      </button>

      {fileName && (
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{fileName}</span>
          <span className="text-muted-foreground/60">{fileSize}</span>
        </div>
      )}
    </div>
  );
}

