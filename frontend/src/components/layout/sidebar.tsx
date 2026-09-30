'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getCurrentUser } from '@/lib/api/auth';
import { getAuthToken } from '@/lib/auth/token';
import { listScheduledJobs, listSentJobs } from '@/lib/api/jobs';
import { listSenders } from '@/lib/api/senders';
import { AlertTriangle, CalendarClock, CheckCircle2, MailPlus, Users } from 'lucide-react';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

/** Render the Sidebar component. */
export default function Sidebar() {
  const pathname = usePathname();
  const isVisible = usePageVisibility();
  const token = getAuthToken();
  const tokenProfile = useMemo(() => {
    if (!token) return null;
    try {
      const [, payload] = token.split('.');
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return { name: decoded?.name as string | undefined, email: decoded?.email as string | undefined };
    } catch {
      return null;
    }
  }, [token]);
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: Boolean(token)
  });
  const displayName = useMemo(() => {
    if (userLoading) {
      return 'Loading profile...';
    }
    const nameSource = user?.name ?? tokenProfile?.name;
    const emailSource = user?.email ?? tokenProfile?.email;
    if (nameSource?.trim()) {
      return nameSource.trim();
    }
    if (emailSource) {
      const localPart = emailSource.split('@')[0] ?? '';
      const words = localPart.replace(/[._-]+/g, ' ').trim();
      if (!words) {
        return emailSource;
      }
      return words
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(' ');
    }
    return 'Account';
  }, [tokenProfile?.email, tokenProfile?.name, user?.email, user?.name, userLoading]);

  const avatarSrc = useMemo(() => {
    if (user?.image) {
      return user.image;
    }
    const emailSource = user?.email ?? tokenProfile?.email;
    if (emailSource) {
      const seed = encodeURIComponent(emailSource.toLowerCase());
      return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
    }
    return '';
  }, [tokenProfile?.email, user?.email, user?.image]);

  const initials = useMemo(() => {
    const source = displayName || user?.email || tokenProfile?.email || 'Account';
    return source
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [displayName, tokenProfile?.email, user?.email]);
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
    {
      href: '/app/scheduled',
      label: 'Scheduled',
      count: scheduled?.total ?? scheduled?.jobs?.length ?? 0,
      icon: CalendarClock
    },
    {
      href: '/app/sent',
      label: 'Sent',
      count: sent?.total ?? sent?.jobs?.length ?? 0,
      icon: CheckCircle2
    },
    {
      href: '/app/failed',
      label: 'Failed',
      count: failedCount,
      icon: AlertTriangle
    },
    {
      href: '/app/senders',
      label: 'Senders',
      count: senders.length,
      icon: Users
    }
  ];

  return (
    <aside className="flex h-full w-full flex-col gap-6 rounded-3xl border bg-white p-6 shadow-sm ">
      <div>
        <h2 className="heading-font text-lg font-semibold text-[#7b1b5a]">Email Job Scheduler</h2>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarSrc} alt={displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {user?.email ?? tokenProfile?.email ?? (userLoading ? 'Loading profile...' : token ? '' : 'Sign in required')}
          </p>
        </div>
      </div>

      <Link
        href="/app/compose"
        className="group inline-flex items-center gap-2 rounded-lg bg-[#7b1b5a] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7b1b5a]/30 transition-all hover:shadow-xl hover:shadow-[#7b1b5a]/40"
      >
        <MailPlus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
        Compose
      </Link>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {item.count}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

