'use client';

import type { Job } from '@/types/job';
import StatusPill from '@/components/jobs/status-pill';
import { formatJobTime } from '@/lib/utils/format-date';

interface JobRowProps {
  job: Job;
  onSelect: (job: Job) => void;
  onRemove: (job: Job) => void;
}

/** Render the JobRow component. */
export default function JobRow({ job, onSelect, onRemove }: JobRowProps) {
  const time = formatJobTime(job.scheduledAt ?? job.sentAt);

  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border/70 bg-white px-5 py-4 text-left transition hover:bg-white">
      <button type="button" onClick={() => onSelect(job)} className="flex flex-1 items-center gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">To: {job.email || 'Unknown recipient'}</p>
          <p className="text-xs text-muted-foreground">{job.subject || 'Subject unavailable'}</p>
        </div>
      </button>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{time}</span>
        <StatusPill status={job.status} />
        <button
          type="button"
          onClick={() => onRemove(job)}
          className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

