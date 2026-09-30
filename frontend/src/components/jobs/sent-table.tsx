'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { listSentJobs } from '@/lib/api/jobs';
import { formatJobTime } from '@/lib/utils/format-date';
import { getApiErrorMessage } from '@/lib/utils/api-error';
import { copyToClipboard } from '@/lib/utils/clipboard';
import StatusPill from '@/components/jobs/status-pill';
import CampaignTimelineDialog from '@/components/campaigns/campaign-timeline-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

const truncate = (value: string, length = 60) => (value.length > length ? `${value.slice(0, length)}...` : value);

const filters = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' }
] as const;

/** Render the SentTable component. */
export default function SentTable() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const isVisible = usePageVisibility();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['jobs', 'sent', statusFilter, page, limit],
    queryFn: () =>
      listSentJobs({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit
      }),
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true,
    retry: 1
  });

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return data?.jobs ?? [];
    return (data?.jobs ?? []).filter((job) => job.status === statusFilter);
  }, [data?.jobs, statusFilter]);
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const lastUpdatedSeconds = dataUpdatedAt ? Math.max(Math.round((Date.now() - dataUpdatedAt) / 1000), 0) : null;
  const lastUpdatedLabel =
    lastUpdatedSeconds === null
      ? null
      : lastUpdatedSeconds < 2
      ? 'Last updated: just now'
      : `Last updated: ${lastUpdatedSeconds}s ago`;

  return (
    <div className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
      {lastUpdatedLabel && !isLoading && (
        <p className="mb-3 text-right text-xs text-muted-foreground">{lastUpdatedLabel}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <p className="text-sm font-semibold">Filter</p>
        <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
          {filters.map((filter) => {
            const active = filter.id === statusFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={cn(
                  'relative flex items-center gap-2 overflow-hidden rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border border-[#e7c6d9] bg-[#f7e9f1] text-[#7b1b5a]'
                    : 'border border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sentFilter"
                    className="absolute bottom-1 left-1 top-1 w-1 rounded-full bg-[#7b1b5a]"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

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
          <p className="text-sm text-muted-foreground">{getApiErrorMessage(error, 'Unable to load sent jobs.')}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">No messages found for this filter.</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <Table className="table-fixed border-separate border-spacing-0">
          <TableHeader>
            <tr className="border-b border-border/60 text-muted-foreground">
              <TableHead className="w-[240px]">Recipient</TableHead>
              <TableHead className="w-[220px]">Campaign subject</TableHead>
              <TableHead className="w-[170px]">Sent time</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[70px]">Attempts</TableHead>
              <TableHead className="w-[200px]">Last error</TableHead>
              <TableHead className="w-[140px] text-left">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.map((job, index) => {
              const initials = (job.email || 'U')
                .split('@')[0]
                .slice(0, 2)
                .toUpperCase();
              const relativeTime = job.sentAt
                ? formatDistanceToNowStrict(new Date(job.sentAt), { addSuffix: true })
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
                    <p className="text-xs text-muted-foreground">Delivery completed</p>
                  </TableCell>
                  <TableCell title={job.sentAt ?? ''}>
                    <p className="font-medium text-foreground">{relativeTime}</p>
                    <p className="text-xs text-muted-foreground">{formatJobTime(job.sentAt)}</p>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={job.status} />
                  </TableCell>
                  <TableCell>{job.attempts ?? '-'}</TableCell>
                  <TableCell title={job.lastError ?? ''}>
                    {job.lastError ? truncate(job.lastError) : '-'}
                  </TableCell>
                  <TableCell className="text-left align-middle">
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
                        onClick={async () => {
                          const ok = await copyToClipboard(job.id);
                          if (ok) {
                            toast.success('Copied.');
                          } else {
                            toast.error('Copy failed.');
                          }
                        }}
                        className={cn(
                          'inline-flex h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground transition',
                          'opacity-0 group-hover:opacity-100 hover:border-border hover:text-foreground'
                        )}
                        title="Copy job id"
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
