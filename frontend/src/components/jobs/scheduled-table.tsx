'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { Copy, Info, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { cancelJob, listScheduledJobs } from '@/lib/api/jobs';
import { formatJobTime } from '@/lib/utils/format-date';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { getApiErrorMessage } from '@/lib/utils/api-error';
import StatusPill from '@/components/jobs/status-pill';
import CampaignTimelineDialog from '@/components/campaigns/campaign-timeline-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

/** Render the ScheduledTable component. */
export default function ScheduledTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 20;
  const isVisible = usePageVisibility();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['jobs', 'scheduled', page, limit],
    queryFn: () => listScheduledJobs({ page, limit }),
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true,
    retry: 1
  });
  const jobs = data?.jobs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const lastUpdatedSeconds = dataUpdatedAt ? Math.max(Math.round((Date.now() - dataUpdatedAt) / 1000), 0) : null;
  const lastUpdatedLabel =
    lastUpdatedSeconds === null
      ? null
      : lastUpdatedSeconds < 2
      ? 'Last updated: just now'
      : `Last updated: ${lastUpdatedSeconds}s ago`;

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => cancelJob(jobId),
    onSuccess: (_data, jobId) => {
      queryClient.setQueriesData({ queryKey: ['jobs', 'scheduled'], exact: false }, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData.jobs)) return oldData;
        const updatedJobs = oldData.jobs.filter((job: { id: string }) => job.id !== jobId);
        const total = Math.max((oldData.total ?? updatedJobs.length) - 1, 0);
        const limitValue = oldData.limit ?? updatedJobs.length ?? 1;
        return {
          ...oldData,
          jobs: updatedJobs,
          total,
          totalPages: Math.max(Math.ceil(total / limitValue), 1)
        };
      });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to cancel job.'));
    }
  });

  const handleCopy = async (value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      toast.success('Copied.');
    } else {
      toast.error('Copy failed.');
    }
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
      {lastUpdatedLabel && !isLoading && (
        <p className="mb-3 text-right text-xs text-muted-foreground">{lastUpdatedLabel}</p>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{getApiErrorMessage(error, 'Unable to load scheduled jobs.')}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <div className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <Mail className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No scheduled emails yet.</p>
            <Link
              href="/app/compose"
              className="inline-flex items-center gap-2 rounded-lg bg-[#7b1b5a] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#7b1b5a]/30 transition-all hover:shadow-xl hover:shadow-[#7b1b5a]/40"
            >
              Compose campaign
            </Link>
          </div>
        </div>
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <Table className="table-fixed border-separate border-spacing-0">
          <TableHeader>
            <tr className="border-b border-border/60 text-muted-foreground">
              <TableHead className="w-[260px]">Recipient</TableHead>
              <TableHead className="w-[220px]">Campaign subject</TableHead>
              <TableHead className="w-[160px]">Scheduled time</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[110px] pr-8">Attempts</TableHead>
              <TableHead className="w-[200px] pl-8 text-left">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {jobs.map((job, index) => {
              const initials = (job.email || 'U')
                .split('@')[0]
                .slice(0, 2)
                .toUpperCase();
              const relativeTime = job.scheduledAt
                ? formatDistanceToNowStrict(new Date(job.scheduledAt), { addSuffix: true })
                : '-';
              const isCancelable = job.status === 'scheduled' || job.status === 'rescheduled';
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
                    <div className="flex items-center gap-3 pl-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7b1b5a] text-xs font-semibold text-white">
                        {initials}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{job.email || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{job.campaignId ?? 'Campaign'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{job.subject || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">Queued for delivery</p>
                  </TableCell>
                  <TableCell title={job.scheduledAt ?? ''}>
                    <p className="font-medium text-foreground">{relativeTime}</p>
                    <p className="text-xs text-muted-foreground">{formatJobTime(job.scheduledAt)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusPill status={job.status} />
                      {job.status === 'rescheduled' && (
                        <span
                          className="inline-flex items-center text-muted-foreground"
                          title="Hourly quota reached for this sender; job queued for the next available window."
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-8">{job.attempts ?? '-'}</TableCell>
                  <TableCell className="pl-8 text-left align-middle">
                    <div className="flex items-center justify-start gap-3">
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <CampaignTimelineDialog
                          campaignId={job.campaignId}
                          subject={job.subject}
                          iconOnly
                          triggerClassName="h-8 w-8 rounded-lg border border-border/70 bg-white/80 p-0 text-muted-foreground hover:text-foreground"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate(job.id)}
                        disabled={!isCancelable || cancelMutation.isPending}
                        title={isCancelable ? 'Cancel scheduled job' : 'Only queued jobs can be canceled'}
                        className={cn(
                          'inline-flex h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground transition',
                          'opacity-0 group-hover:opacity-100 hover:border-border hover:text-foreground',
                          (!isCancelable || cancelMutation.isPending) &&
                            'cursor-not-allowed opacity-50 hover:border-border/70 hover:text-muted-foreground'
                        )}
                      >
                        {cancelMutation.isPending ? 'Canceling' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(job.id)}
                        className={cn(
                          'inline-flex h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground transition',
                          'opacity-0 group-hover:opacity-100 hover:border-border hover:text-foreground'
                        )}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy ID
                      </button>
                    </div>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      )}

      {!isLoading && !isError && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
