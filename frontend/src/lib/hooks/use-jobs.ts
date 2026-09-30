'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listScheduledJobs, listSentJobs } from '@/lib/api/jobs';
import { toast } from 'sonner';
import type { PaginatedJobs } from '@/types/job';

export type JobsMode = 'scheduled' | 'sent';

/**
 * Fetch jobs for the selected mode with polling and retry messaging.
 */
/** useJobs helper. */
export function useJobs(mode: JobsMode) {
  const queryClient = useQueryClient();
  return useQuery<PaginatedJobs>({
    queryKey: ['jobs', mode],
    queryFn: async () => {
      try {
        return mode === 'scheduled' ? await listScheduledJobs() : await listSentJobs();
      } catch (error) {
        toast.error('Unable to load jobs.', {
          action: {
            label: 'Retry',
            onClick: () => queryClient.invalidateQueries({ queryKey: ['jobs', mode] })
          }
        });
        throw error;
      }
    },
    refetchInterval: 5000,
    retry: 1
  });
}
