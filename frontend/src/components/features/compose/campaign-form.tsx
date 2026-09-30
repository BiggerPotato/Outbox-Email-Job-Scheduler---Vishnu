'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, Mail, Upload, XCircle } from 'lucide-react';
import { campaignSchema, type CampaignFormValues } from '@/lib/validations/campaign-schema';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
import { listSenders } from '@/lib/api/senders';
import CsvUploader from '@/components/features/compose/csv-uploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

interface CampaignFormProps {
  onSuccess?: () => void;
}

const statsConfig = [
  {
    key: 'total',
    label: 'Total Emails',
    icon: Mail,
    className: 'bg-[#f7e9f1] text-[#7b1b5a] border-[#e7c6d9]'
  },
  {
    key: 'valid',
    label: 'Valid',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    key: 'invalid',
    label: 'Invalid',
    icon: XCircle,
    className: 'bg-rose-50 text-rose-700 border-rose-200'
  }
] as const;

/** Render the CampaignForm component. */
export default function CampaignForm({ onSuccess }: CampaignFormProps) {
  const { createCampaign } = useCampaigns();
  const queryClient = useQueryClient();
  const { data: senders = [], isError: sendersError } = useQuery({
    queryKey: ['senders'],
    queryFn: listSenders
  });
  const sendersNotifiedRef = useRef(false);

  useEffect(() => {
    if (sendersError && !sendersNotifiedRef.current) {
      sendersNotifiedRef.current = true;
      toast.error('Unable to load senders.', {
        action: {
          label: 'Retry',
          onClick: () => queryClient.invalidateQueries({ queryKey: ['senders'] })
        }
      });
    }
  }, [sendersError, queryClient]);

  const [csvStats, setCsvStats] = useState({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
  const [recipients, setRecipients] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      subject: '',
      body: '',
      senderId: '',
      startDate: new Date(),
      startTime: '09:00',
      delayBetweenEmails: 2,
      hourlyLimit: 120,
      recipients: []
    }
  });

  const startDate = watch('startDate');

  const onSubmit = handleSubmit(async (values) => {
    const [hours, minutes] = values.startTime.split(':').map(Number);
    const scheduled = new Date(values.startDate);
    scheduled.setHours(hours || 0, minutes || 0, 0, 0);

    try {
      await createCampaign.mutateAsync({
        senderId: values.senderId,
        subject: values.subject,
        body: values.body,
        recipients: values.recipients,
        scheduledStartAt: scheduled.toISOString(),
        delayBetweenEmails: values.delayBetweenEmails * 1000,
        hourlyLimit: values.hourlyLimit
      });
      onSuccess?.();
    } catch {
      toast.error('Unable to schedule campaign.');
    }
  });

  const preview = useMemo(
    () => `${csvStats.valid} emails detected, ${csvStats.invalid} invalid, ${csvStats.duplicates} duplicates`,
    [csvStats]
  );

  return (
    <form className="space-y-8" onSubmit={onSubmit}>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Subject
              </label>
              <Input placeholder="Welcome to our product" {...register('subject')} />
              {errors.subject && <p className="text-xs text-rose-500">{errors.subject.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Sender
              </label>
              <input type="hidden" {...register('senderId')} />
              <Select
                onValueChange={(value) => setValue('senderId', value, { shouldValidate: true })}
                defaultValue={watch('senderId')}
              >
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder="Select sender" />
                </SelectTrigger>
                <SelectContent>
                  {senders.map((sender) => (
                    <SelectItem key={sender.id} value={sender.id}>
                      {sender.name} ({sender.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.senderId && <p className="text-xs text-rose-500">{errors.senderId.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Body
            </label>
            <Textarea placeholder="Write your campaign body here..." {...register('body')} />
            {errors.body && <p className="text-xs text-rose-500">{errors.body.message}</p>}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              CSV Recipients
            </label>
            <input type="hidden" {...register('recipients')} />
            <CsvUploader
              onParsed={(result) => {
                setCsvStats({
                  total: result.valid.length + result.invalid.length + result.duplicates,
                  valid: result.valid.length,
                  invalid: result.invalid.length,
                  duplicates: result.duplicates
                });
                setRecipients(result.valid);
                setValue('recipients', result.valid, { shouldValidate: true });
              }}
            />
            <p className="text-xs text-muted-foreground">{preview}</p>
            {errors.recipients && <p className="text-xs text-rose-500">{errors.recipients.message}</p>}

            <div className="grid gap-4 md:grid-cols-3">
              {statsConfig.map((stat, index) => {
                const value =
                  stat.key === 'total'
                    ? csvStats.total
                    : stat.key === 'valid'
                    ? csvStats.valid
                    : csvStats.invalid;
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.key}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn('rounded-xl border p-4', stat.className)}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="mt-2 text-2xl font-semibold">{value}</div>
                    <div className="text-xs uppercase tracking-[0.2em] opacity-80">{stat.label}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">Schedule</p>
                <p className="text-xs text-muted-foreground">Pick a date and time to start.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Start Date
                </label>
                <input type="hidden" {...register('startDate', { valueAsDate: true })} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between rounded-lg">
                      {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="rounded-2xl border-border/70 shadow-xl">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setValue('startDate', date, { shouldValidate: true })}
                    />
                  </PopoverContent>
                </Popover>
                {errors.startDate && <p className="text-xs text-rose-500">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Start Time
                </label>
                <Input type="time" {...register('startTime')} />
                {errors.startTime && <p className="text-xs text-rose-500">{errors.startTime.message}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Delay (seconds)
                  </label>
                  <Input type="number" min={0} {...register('delayBetweenEmails')} />
                  {errors.delayBetweenEmails && (
                    <p className="text-xs text-rose-500">{errors.delayBetweenEmails.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Hourly Limit
                  </label>
                  <Input type="number" min={1} {...register('hourlyLimit')} />
                  {errors.hourlyLimit && <p className="text-xs text-rose-500">{errors.hourlyLimit.message}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Recipients ready</p>
                <p className="text-xs text-muted-foreground">
                  {recipients.length} queued for scheduling
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7e9f1] text-[#7b1b5a]">
                <Upload className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-8 border-t border-border/70 bg-white/95 px-8 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            All sends are protected with rate limiting and retries.
          </p>
          <Button
            type="submit"
            disabled={createCampaign.isPending}
            className="rounded-lg bg-[#7b1b5a] text-white shadow-lg shadow-[#7b1b5a]/30 hover:shadow-xl hover:shadow-[#7b1b5a]/40"
          >
            {createCampaign.isPending ? 'Scheduling...' : 'Schedule Campaign'}
          </Button>
        </div>
      </div>
    </form>
  );
}
