'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Gauge, Mail, RotateCcw, Send } from 'lucide-react';
import { getCampaignTimeline } from '@/lib/api/campaigns';
import { formatJobTime } from '@/lib/utils/format-date';
import type { CampaignTimelineEvent } from '@/types/timeline';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface CampaignTimelineDialogProps {
  campaignId?: string;
  subject?: string;
  triggerLabel?: string;
  iconOnly?: boolean;
  triggerClassName?: string;
}

const eventStyles: Record<
  CampaignTimelineEvent['type'],
  { label: string; Icon: typeof Mail; tone: string }
> = {
  campaign_created: { label: 'Campaign created', Icon: Mail, tone: 'text-primary' },
  campaign_scheduled: { label: 'Campaign scheduled', Icon: CalendarClock, tone: 'text-primary' },
  job_scheduled: { label: 'Job scheduled', Icon: Clock, tone: 'text-muted-foreground' },
  job_sending: { label: 'Sending', Icon: Send, tone: 'text-blue-600' },
  job_sent: { label: 'Delivered', Icon: CheckCircle2, tone: 'text-emerald-600' },
  job_failed: { label: 'Failed', Icon: AlertTriangle, tone: 'text-rose-600' },
  rate_limited: { label: 'Rate limited', Icon: Gauge, tone: 'text-amber-600' },
  job_retry: { label: 'Retry', Icon: RotateCcw, tone: 'text-amber-600' }
};

/** Render the CampaignTimelineDialog component. */
export default function CampaignTimelineDialog({
  campaignId,
  subject,
  triggerLabel = 'View timeline',
  iconOnly = false,
  triggerClassName
}: CampaignTimelineDialogProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['campaigns', 'timeline', campaignId],
    queryFn: () => (campaignId ? getCampaignTimeline(campaignId) : Promise.resolve({ campaignId: '', events: [] })),
    enabled: open && Boolean(campaignId)
  });

  const events = useMemo(() => data?.events ?? [], [data?.events]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={iconOnly ? 'ghost' : 'outline'}
          size="sm"
          disabled={!campaignId}
          className={triggerClassName}
        >
          {iconOnly ? <Mail className="h-4 w-4" /> : triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campaign timeline</DialogTitle>
          <DialogDescription>
            {subject ? `Activity for "${subject}".` : 'Activity for this campaign.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Unable to load the timeline.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && events.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet for this campaign.</p>
        )}

        {!isLoading && !isError && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => {
              const config = eventStyles[event.type] ?? eventStyles.job_scheduled;
              const { Icon } = config;
              return (
                <div key={event.id} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted ${config.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{event.message || config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.label}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatJobTime(event.at)}</div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Open/click tracking is not configured yet, so those events do not appear.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
