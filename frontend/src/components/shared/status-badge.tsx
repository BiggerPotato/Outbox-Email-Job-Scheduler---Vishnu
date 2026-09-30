'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Clock, Loader2, RotateCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { JobStatus } from '@/types/job';

const statusConfig: Record<
  JobStatus,
  { label: string; className: string; icon: typeof Clock; dot?: boolean }
> = {
  scheduled: {
    label: 'Queued',
    className: 'bg-[#f7e9f1] text-[#7b1b5a] border-[#e7c6d9]',
    icon: Clock
  },
  rescheduled: {
    label: 'Rate limited',
    className: 'bg-[#f0e6ef] text-[#6a184f] border-[#dfc0d4]',
    icon: RotateCw
  },
  sending: {
    label: 'Sending',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Loader2,
    dot: true
  },
  sent: {
    label: 'Sent',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle
  },
  failed: {
    label: 'Failed',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: XCircle
  },
  canceled: {
    label: 'Canceled',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: XCircle
  }
};

/** Render the StatusBadge component. */
/** Render the StatusBadge component. */
export default function StatusBadge({ status }: { status: JobStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        config.className
      )}
    >
      {config.dot && (
        <motion.span
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="h-1.5 w-1.5 rounded-full bg-current"
        />
      )}
      <Icon className={cn('h-3.5 w-3.5', status === 'sending' ? 'animate-spin' : '')} />
      {config.label}
    </span>
  );
}
