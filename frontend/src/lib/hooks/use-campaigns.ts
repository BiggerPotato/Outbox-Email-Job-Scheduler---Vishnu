'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCampaign, listCampaigns } from '@/lib/api/campaigns';
import type { CampaignCreateRequest } from '@/types/api';
import { toast } from 'sonner';

/** useCampaigns helper. */
export function useCampaigns() {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: listCampaigns
  });

  const createMutation = useMutation({
    mutationFn: (payload: CampaignCreateRequest) => createCampaign(payload),
    onError: (_error, payload) => {
      toast.error('Campaign creation failed.', {
        action: {
          label: 'Retry',
          onClick: () => createMutation.mutate(payload)
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'sent'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'failed'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'scheduled', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'sent', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'failed', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'scheduled', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'sent', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'scheduled', 'tab'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'sent', 'tab'] });
    }
  });

  return {
    ...campaignsQuery,
    createCampaign: createMutation
  };
}
