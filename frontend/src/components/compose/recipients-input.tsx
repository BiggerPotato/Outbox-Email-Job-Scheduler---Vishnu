'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { isValidEmail } from '@/lib/utils/validate-email';

interface RecipientsInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  onInvalid?: (email: string) => void;
}

/** Render the RecipientsInput component. */
export default function RecipientsInput({ value, onChange, onInvalid }: RecipientsInputProps) {
  const [input, setInput] = useState('');

  const addEmail = (email: string) => {
    const normalized = email.trim();
    if (!normalized) return;
    if (!isValidEmail(normalized)) {
      onInvalid?.(normalized);
      return;
    }
    if (value.includes(normalized)) return;
    onChange([...value, normalized]);
    setInput('');
  };

  return (
    <div className="rounded-2xl border border-border bg-white px-3 py-2">
      <div className="flex flex-wrap gap-2">
        {value.map((email) => (
          <span
            key={email}
            className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== email))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              addEmail(input);
            }
          }}
          onBlur={() => addEmail(input)}
          placeholder="Add recipients"
          className="flex-1 bg-transparent py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

