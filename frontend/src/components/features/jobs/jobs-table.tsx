'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import type { Job } from '@/types/job';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import StatusBadge from '@/components/shared/status-badge';
import JobsSkeleton from '@/components/features/jobs/jobs-skeleton';
import EmptyState from '@/components/features/jobs/empty-state';

interface JobsTableProps {
  jobs: Job[];
  isLoading?: boolean;
  mode: 'scheduled' | 'sent';
}

/** Render the JobsTable component. */
export default function JobsTable({ jobs, isLoading, mode }: JobsTableProps) {
  if (isLoading) {
    return <JobsSkeleton />;
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title={mode === 'scheduled' ? 'No campaigns scheduled' : 'No sends recorded'}
        description={
          mode === 'scheduled'
            ? 'Upload a CSV and schedule your first campaign.'
            : 'Once emails are sent they will appear here.'
        }
      />
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-white shadow-sm">
      <Table className="border-separate border-spacing-0">
        <TableHeader>
          <tr className="border-b border-border/60 text-muted-foreground">
            <TableHead>Email</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>{mode === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}</TableHead>
            <TableHead>Status</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {jobs.map((job, index) => {
            const timeValue = mode === 'scheduled' ? job.scheduledAt : job.sentAt;
            const relativeTime = timeValue
              ? formatDistanceToNowStrict(new Date(timeValue), { addSuffix: true })
              : '-';
            return (
              <motion.tr
                key={job.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="group relative border-b border-border/40 transition-colors hover:bg-muted/40"
              >
                <TableCell className="relative">
                  <span className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-[#7b1b5a] opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="pl-2 font-medium text-foreground">{job.email}</div>
                </TableCell>
                <TableCell>{job.subject}</TableCell>
                <TableCell title={timeValue ?? ''}>
                  <p className="font-medium text-foreground">{relativeTime}</p>
                  <p className="text-xs text-muted-foreground">{timeValue ?? '-'}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={job.status} />
                </TableCell>
              </motion.tr>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
