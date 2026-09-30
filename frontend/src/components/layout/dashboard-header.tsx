'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bell, ChevronDown, LogOut, Mail, MailPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { clearAuthToken, getAuthToken } from '@/lib/auth/token';
import { getCurrentUser, logout } from '@/lib/api/auth';
import { listScheduledJobs, listSentJobs } from '@/lib/api/jobs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { usePathname } from 'next/navigation';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

/** Render the DashboardHeader component. */
export default function DashboardHeader() {
  const token = getAuthToken();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isVisible = usePageVisibility();
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
  const { data: user, isError: userError, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    retry: 1
  });
  const { data: scheduled } = useQuery({
    queryKey: ['jobs', 'scheduled', 'summary'],
    queryFn: () => listScheduledJobs({ page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });
  const { data: sent } = useQuery({
    queryKey: ['jobs', 'sent', 'summary'],
    queryFn: () => listSentJobs({ page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });
  const userNotifiedRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (userError && !userNotifiedRef.current) {
      userNotifiedRef.current = true;
      toast.error('Unable to load profile.');
    }
  }, [userError]);

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

  const scheduledCount = scheduled?.total ?? 0;
  const sentCount = sent?.total ?? 0;

  const { title, subtitle } = useMemo(() => {
    const routes = [
      { match: '/app/compose', title: 'Compose', subtitle: 'Create campaign job' },
      { match: '/app/scheduled', title: 'Scheduled', subtitle: 'Scheduled mail list' },
      { match: '/app/sent', title: 'Sent', subtitle: 'Delivered mail logs' },
      { match: '/app/failed', title: 'Failed', subtitle: 'Failed delivery log' },
      { match: '/app/senders', title: 'Senders', subtitle: 'Sender accounts' },
      { match: '/app', title: 'Scheduled', subtitle: 'Scheduled mail list' }
    ];
    const current = routes.find((route) => pathname.startsWith(route.match));
    return current ?? { title: 'Dashboard', subtitle: 'Mail activity overview' };
  }, [pathname]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 rounded-3xl border border-transparent px-6 py-4 transition-all duration-300',
        scrolled ? 'border-border bg-white/80 shadow-sm backdrop-blur-xl' : 'bg-white/60 backdrop-blur'
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7b1b5a] text-white shadow-lg shadow-[#7b1b5a]/30">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h1 className="heading-font text-xl font-semibold text-[#7b1b5a]">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <div className="hidden w-56 overflow-hidden rounded-2xl border border-border bg-white/70 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur lg:flex">
            <div className="flex w-full items-center justify-between">
              <span>{scheduledCount} scheduled</span>
              <span className="text-foreground/70">·</span>
              <span>{sentCount} sent today</span>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative hidden rounded-lg lg:block"
          >
            <Link
              href="/app/compose"
              className="relative z-10 inline-flex items-center gap-2 rounded-lg bg-[#7b1b5a] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#7b1b5a]/30 transition-all hover:shadow-xl hover:shadow-[#7b1b5a]/40"
            >
              <MailPlus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
              Compose Email
              <span className="pointer-events-none absolute inset-0 rounded-lg bg-white/15 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </motion.div>

          <Button variant="outline" size="sm" className="rounded-xl border-border/60 bg-white/70 px-3">
            <Bell className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white/80 px-3 py-2 text-left shadow-sm backdrop-blur transition hover:bg-white">
                <Avatar className="h-9 w-9 ring-2 ring-[#f2d8e6]">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email ?? tokenProfile?.email ?? 'Sign in to sync'}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl border border-border/60 bg-white/90 p-2 shadow-xl backdrop-blur">
              <DropdownMenuItem asChild>
                <Link href="/app/senders">Manage senders</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/scheduled">Scheduled</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-rose-600 focus:bg-rose-50"
                onClick={async () => {
                  try {
                    await logout();
                  } catch {
                    // Fallback to local logout.
                  } finally {
                    clearAuthToken();
                    window.location.href = '/login';
                  }
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
