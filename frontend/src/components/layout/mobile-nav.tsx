'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { listScheduledJobs, listSentJobs } from '@/lib/api/jobs';
import { listSenders } from '@/lib/api/senders';
import { AlertTriangle, CalendarClock, CheckCircle2, MailPlus, Users } from 'lucide-react';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

/** Render the MobileNav component. */
export default function MobileNav() {
  const pathname = usePathname();
  const isVisible = usePageVisibility();
  const { data: scheduled } = useQuery({
    queryKey: ['jobs', 'scheduled', 'count'],
    queryFn: () => listScheduledJobs({ page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });
  const { data: sent } = useQuery({
    queryKey: ['jobs', 'sent', 'count'],
    queryFn: () => listSentJobs({ page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });
  const { data: failed } = useQuery({
    queryKey: ['jobs', 'failed', 'count'],
    queryFn: () => listSentJobs({ status: 'failed', page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });
  const { data: senders = [] } = useQuery({
    queryKey: ['senders', 'count'],
    queryFn: listSenders,
    staleTime: 5000
  });

  const failedCount = failed?.total ?? 0;

  const navItems = [
    { href: '/app/scheduled', label: 'Scheduled', count: scheduled?.total ?? scheduled?.jobs?.length ?? 0, icon: CalendarClock },
    { href: '/app/sent', label: 'Sent', count: sent?.total ?? sent?.jobs?.length ?? 0, icon: CheckCircle2 },
    { href: '/app/failed', label: 'Failed', count: failedCount, icon: AlertTriangle },
    { href: '/app/senders', label: 'Senders', count: senders.length, icon: Users }
  ];

  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm ">
      <div className="flex items-center justify-between">
        <div>
          <p className="heading-font text-sm font-semibold text-[#7b1b5a]">Email Job Scheduler</p>
        </div>
        <Link
          href="/app/compose"
          className="inline-flex items-center gap-2 rounded-lg bg-[#7b1b5a] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#7b1b5a]/30"
        >
          <MailPlus className="h-4 w-4" />
          Compose
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium',
                active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {item.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

