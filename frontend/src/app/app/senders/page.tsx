'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listSenders, createSender, deleteSender } from '@/lib/api/senders';
import type { Sender } from '@/types/sender';
import Topbar from '@/components/layout/topbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface SenderFormValues {
  name: string;
  email: string;
}

/** Render the SendersPage component. */
export default function SendersPage() {
  const queryClient = useQueryClient();
  const { data: senders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['senders'],
    queryFn: listSenders
  });
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (isError && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.error('Unable to load senders.', {
        action: { label: 'Retry', onClick: () => refetch() }
      });
    }
  }, [isError, refetch]);

  const { register, handleSubmit, reset } = useForm<SenderFormValues>({
    defaultValues: { name: '', email: '' }
  });

  const createMutation = useMutation({
    mutationFn: (values: SenderFormValues) => createSender(values),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ['senders'] });
      const previous = queryClient.getQueryData<Sender[]>(['senders']);
      const optimistic: Sender = {
        id: `optimistic-${Date.now()}`,
        name: values.name,
        email: values.email
      };
      queryClient.setQueryData<Sender[]>(['senders'], (old) => [optimistic, ...(old ?? [])]);
      return { previous };
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['senders'], context.previous);
      }
      toast.error('Unable to add sender.');
    },
    onSuccess: () => {
      toast.success('Sender added.');
      reset();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    await createMutation.mutateAsync(values);
  });

  const handleDelete = (senderId: string) => {
    if (window.confirm('Delete this sender? This cannot be undone.')) {
      deleteMutation.mutate(senderId);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (senderId: string) => deleteSender(senderId),
    onMutate: async (senderId) => {
      await queryClient.cancelQueries({ queryKey: ['senders'] });
      const previous = queryClient.getQueryData<Sender[]>(['senders']);
      queryClient.setQueryData<Sender[]>(['senders'], (old) => (old ?? []).filter((s) => s.id !== senderId));
      return { previous };
    },
    onError: (error, _senderId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['senders'], context.previous);
      }
      const message =
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Unable to delete sender.';
      toast.error(message);
    },
    onSuccess: () => {
      toast.success('Sender deleted.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    }
  });

  return (
    <div className="space-y-6">
      <Topbar search="" onSearchChange={(value) => void value} onRefresh={() => refetch()} />

      <div>
        <h1 className="heading-font text-2xl font-semibold">Senders</h1>
        <p className="text-sm text-muted-foreground">Manage verified sender identities.</p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-sm md:grid-cols-3">
        <div className="space-y-2 md:col-span-1">
          <label
            htmlFor="sender-name"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Name
          </label>
              <Input id="sender-name" placeholder="Email Job Scheduler" {...register('name', { required: true })} />
        </div>
        <div className="space-y-2 md:col-span-1">
          <label
            htmlFor="sender-email"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Email
          </label>
          <Input id="sender-email" placeholder="sender@outbox.com" type="email" {...register('email', { required: true })} />
        </div>
        <div className="flex items-end md:col-span-1">
          <Button type="submit" disabled={createMutation.isPending} className="w-full">
            {createMutation.isPending ? 'Adding...' : 'Add sender'}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-3xl border bg-white p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-3 h-3 w-56" />
              </div>
            ))
          : senders.map((sender) => (
              <div key={sender.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{sender.name}</p>
                    <p className="text-xs text-muted-foreground">{sender.email}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(sender.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

