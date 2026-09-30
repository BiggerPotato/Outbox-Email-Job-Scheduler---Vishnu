'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { listSentJobs } from '@/lib/api/jobs';
import { formatJobTime } from '@/lib/utils/format-date';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { getApiErrorMessage } from '@/lib/utils/api-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { AlertTriangle, Copy } from 'lucide-react';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

const truncate = (value: string, length = 80) => (value.length > length ? `${value.slice(0, length)}...` : value);

/** Render the FailedPage component. */
export default function FailedPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const isVisible = usePageVisibility();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['jobs', 'failed', page, limit],
    queryFn: () => listSentJobs({ status: 'failed', page, limit }),
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true,
    retry: 1
  });

  const failedJobs = useMemo(
    () => (data?.jobs ?? []).filter((job) => job.status === 'failed'),
    [data?.jobs]
  );
  const totalPages = data?.totalPages ?? 1;
  const lastUpdatedSeconds = dataUpdatedAt ? Math.max(Math.round((Date.now() - dataUpdatedAt) / 1000), 0) : null;
  const lastUpdatedLabel =
    lastUpdatedSeconds === null
      ? null
      : lastUpdatedSeconds < 2
      ? 'Last updated: just now'
      : `Last updated: ${lastUpdatedSeconds}s ago`;

  const handleCopy = async (value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      toast.success('Copied.');
    } else {
      toast.error('Copy failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-font text-2xl font-semibold">Failed</h1>
        <p className="text-sm text-muted-foreground">Failures are retained with the final error for debugging.</p>
      </div>

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
            <p className="text-sm text-muted-foreground">{getApiErrorMessage(error, 'Unable to load failed jobs.')}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && failedJobs.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-rose-400" />
            <p className="text-sm text-muted-foreground">No failed deliveries right now.</p>
          </div>
        )}

        {!isLoading && !isError && failedJobs.length > 0 && (
          <Table className="table-fixed border-separate border-spacing-0">
            <TableHeader>
              <tr className="border-b border-border/60 text-muted-foreground">
                <TableHead className="w-[240px]">Recipient</TableHead>
                <TableHead className="w-[320px]">Last error</TableHead>
                <TableHead className="w-[70px]">Attempts</TableHead>
                <TableHead className="w-[170px]">Scheduled at</TableHead>
                <TableHead className="w-[160px] text-left">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {failedJobs.map((job, index) => {
                const relativeTime = job.scheduledAt
                  ? formatDistanceToNowStrict(new Date(job.scheduledAt), { addSuffix: true })
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
                      <span className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-rose-500 opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="pl-2 font-medium text-foreground">{job.email || 'Unknown'}</div>
                    </TableCell>
                    <TableCell title={job.lastError ?? ''}>{job.lastError ? truncate(job.lastError) : '-'}</TableCell>
                    <TableCell>{job.attempts ?? '-'}</TableCell>
                    <TableCell title={job.scheduledAt ?? ''}>
                      <p className="font-medium text-foreground">{relativeTime}</p>
                      <p className="text-xs text-muted-foreground">{formatJobTime(job.scheduledAt)}</p>
                    </TableCell>
                    <TableCell className="text-left align-middle">
                      <div className="flex items-center justify-start gap-3">
                        <button
                          type="button"
                          className={cn(
                            'inline-flex h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground transition',
                            'opacity-0 group-hover:opacity-100 hover:border-border hover:text-foreground'
                          )}
                          onClick={() => job.lastError && handleCopy(job.lastError)}
                          disabled={!job.lastError}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy error
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
    </div>
  );
}
