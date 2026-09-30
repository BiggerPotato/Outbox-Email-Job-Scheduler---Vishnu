'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Job } from '@/types/job';
import JobRow from '@/components/jobs/job-row';
import JobsSkeleton from '@/components/jobs/jobs-skeleton';
import JobsEmptyState from '@/components/jobs/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCampaign } from '@/lib/api/campaigns';
import { getHiddenJobs, hideJob } from '@/lib/utils/job-visibility';
import { toast } from 'sonner';

interface JobsTableProps {
  jobs: Job[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  mode: 'scheduled' | 'sent';
}

/** Render the JobsTable component. */
export default function JobsTable({ jobs, isLoading, isError, onRetry, mode }: JobsTableProps) {
  const [selected, setSelected] = useState<Job | null>(null);

  const { data: campaign } = useQuery({
    queryKey: ['campaign', selected?.campaignId],
    queryFn: () => getCampaign(selected?.campaignId ?? ''),
    enabled: Boolean(selected?.campaignId)
  });

  const visibleJobs = useMemo(() => {
    const hidden = new Set(getHiddenJobs());
    return jobs.filter((job) => !hidden.has(job.id));
  }, [jobs]);

  if (isLoading) {
    return <JobsSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">We could not load this list.</p>
        <Button className="mt-4" variant="outline" onClick={() => onRetry?.()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!visibleJobs.length) {
    return (
      <JobsEmptyState
        title={mode === 'scheduled' ? 'No scheduled emails yet' : 'No sent emails yet'}
        description={
          mode === 'scheduled'
            ? 'Create your first campaign to see jobs here.'
            : 'Once emails are sent they will appear here.'
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {visibleJobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            onSelect={setSelected}
            onRemove={(item) => {
              hideJob(item.id);
              toast.message('Removed from view.');
            }}
          />
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recipient</p>
              <p className="font-medium">{selected?.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject</p>
              <p className="font-medium">{selected?.subject}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed">
              {campaign?.body ??
                'Preview will appear once the campaign details are available.'}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

