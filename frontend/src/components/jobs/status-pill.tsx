'use client';

import StatusBadge from '@/components/shared/status-badge';
import type { JobStatus } from '@/types/job';

/** Render the StatusPill component. */
export default function StatusPill({ status }: { status: JobStatus }) {
  return <StatusBadge status={status} />;
}
