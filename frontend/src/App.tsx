import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, AlertTriangle, ArrowRight, Bell, CalendarClock, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, Clock3, Copy, FileText, Gauge, Inbox, Loader2, Mail, Menu, Plus,
  RefreshCw, RotateCcw, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, UserRound, X, Zap,
} from 'lucide-react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendUrl } from '@/lib/api/client';
import { getCurrentUser, logout } from '@/lib/api/auth';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/lib/auth/token';
import { listScheduledJobs, listSentJobs, cancelJob } from '@/lib/api/jobs';
import { listSenders, createSender, deleteSender } from '@/lib/api/senders';
import { createCampaign, getCampaignTimeline } from '@/lib/api/campaigns';
import { validateCsvFile } from '@/lib/api/csv';
import type { Job, JobStatus, Sender, TimelineEvent, TimelineEventType, User } from '@/types';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');
const shortTime = (date?: string) => date ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(date)) : '—';
const dateTime = (date?: string) => date ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date)) : '—';
const relative = (date?: string) => {
  if (!date) return 'Not scheduled';
  const mins = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (mins > 0) return `in ${mins} min`;
  if (mins > -60) return `${Math.abs(mins)} min ago`;
  return `${Math.round(Math.abs(mins) / 60)}h ago`;
};
const initials = (email: string) => {
  if (!email) return 'U';
  return email.split('@')[0].split(/[.\-_]/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() || 'U';
};

function ToastStack({ messages, onDismiss }: { messages: string[]; onDismiss: (message: string) => void }) {
  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-lg"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f8eaf3] text-primary">
              <Check size={14} />
            </span>
            <span className="flex-1">{message}</span>
            <button onClick={() => onDismiss(message)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function LogoMark({ light = false }: { light?: boolean }) {
  return (
    <div className={cx('flex h-9 w-9 items-center justify-center rounded-xl', light ? 'bg-white/15 text-white' : 'bg-primary text-primary-foreground')}>
      <Mail size={17} strokeWidth={2.4} />
    </div>
  );
}

function LoginPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (getAuthToken()) {
      setLocation('/app/scheduled');
    }
  }, [setLocation]);

  const handleGoogle = () => {
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const features = [
    { icon: CalendarClock, title: 'Precision scheduling', text: 'Queue messages with controlled spacing and dependable retries.' },
    { icon: Gauge, title: 'Per-sender rate limits', text: 'Protect deliverability with clear hourly caps for every sender.' },
    { icon: Zap, title: 'Live delivery timeline', text: 'Track queued, sending, and completed jobs without guesswork.' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfd] lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#2b0f1f] px-10 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute -right-40 top-20 h-[32rem] w-[32rem] rounded-full bg-[#7b1b5a]/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark light />
          <span className="font-bold tracking-[-.02em]">Email Job Scheduler</span>
          <span className="ml-1 rounded-full border border-white/15 px-2 py-1 font-mono text-[9px] uppercase tracking-[.18em] text-white/55">Ops console</span>
        </div>
        <div className="relative mt-auto max-w-xl pb-16 pt-24">
          <p className="mb-5 font-mono text-[11px] uppercase tracking-[.22em] text-[#eab1cf]">Campaign operations, clarified</p>
          <h1 className="max-w-lg text-5xl font-extrabold leading-[1.04] tracking-[-.055em]">Schedule emails at scale. Reliably.</h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/64">A calm command center for teams who care about the last mile. Set the rules, watch the queue, trust the delivery.</p>
          <div className="mt-12 grid gap-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur-sm transition hover:bg-white/[.09]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7b1b5a] text-[#f2c9dd]"><Icon size={17} /></span>
                <span>
                  <strong className="block text-sm font-bold">{title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-white/53">{text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-white/40">
          <span>Connected to ReachInbox backend.</span>
          <span className="font-mono">v1.0 / active</span>
        </div>
      </section>
      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <span className="font-bold">Email Job Scheduler</span>
          </div>
          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8eaf3] text-primary">
              <ShieldCheck size={23} />
            </div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary/70">Welcome / Sign in</p>
            <h2 className="text-3xl font-extrabold tracking-[-.04em] text-foreground">Good to see you.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to keep your campaigns moving.</p>
          </div>
          <button
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3.5 text-sm font-bold text-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md cursor-pointer"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#f3f3f3] text-xs font-extrabold text-[#4285F4]">G</span>
            Continue with Google
            <ArrowRight size={16} className="ml-auto text-muted-foreground" />
          </button>
          <div className="my-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground/60">
            <span className="h-px flex-1 bg-border" />
            Private workspace
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="rounded-2xl border border-border bg-white p-4 text-xs leading-5 text-muted-foreground">
            <span className="font-bold text-foreground">No password to remember.</span> Google sign-in keeps access secure and verified with your backend.
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthCallback() {
  const [, setLocation] = useLocation();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const token = new URLSearchParams(search).get('token');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      queryClient.invalidateQueries();
      const timer = window.setTimeout(() => setLocation('/app/scheduled'), 800);
      return () => window.clearTimeout(timer);
    } else {
      setMissing(true);
    }
  }, [token, setLocation]);

  if (missing) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#fcfcfd] p-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0ef] text-destructive">
            <AlertCircle size={24} />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-destructive">Missing token</p>
          <h1 className="mt-3 text-xl font-extrabold">We could not complete sign-in</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The callback did not include a valid session token. Start again to continue.</p>
          <button
            onClick={() => setLocation('/')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-[#611546] cursor-pointer"
          >
            Back to login
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#fcfcfd] p-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#f8eaf3] text-primary">
          <Loader2 className="animate-spin" size={24} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary/70">Signing you in</p>
        <h1 className="mt-3 text-xl font-extrabold">Finalizing your session</h1>
        <p className="mt-2 text-sm text-muted-foreground">Redirecting to your operations console…</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    scheduled: 'bg-[#eef4ff] text-[#3b67a6]',
    rescheduled: 'bg-[#fff4dc] text-[#a26408]',
    sending: 'bg-[#f3eafa] text-[#7b1b5a]',
    sent: 'bg-[#eaf7f1] text-[#25815d]',
    failed: 'bg-[#fff0ef] text-[#b1443c]',
    canceled: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[.08em]', styles[status] || styles.scheduled)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function PageLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-[72px] animate-pulse rounded-2xl bg-muted/70" />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  onAction,
  icon: Icon = Inbox,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  icon?: typeof Inbox;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/60 p-8 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#f8eaf3] text-primary">
        <Icon size={21} />
      </div>
      <h3 className="text-base font-extrabold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
      {action && (
        <button onClick={onAction} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-[#611546] cursor-pointer">
          {action}
        </button>
      )}
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);

  useEffect(() => {
    if (!getAuthToken()) {
      setLocation('/');
    }
  }, [setLocation]);

  useEffect(() => {
    const listener = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (!message) return;
      setToasts((current) => [...current.slice(-2), message]);
      window.setTimeout(() => setToasts((current) => current.filter((item) => item !== message)), 3200);
    };
    window.addEventListener('notify', listener);
    return () => window.removeEventListener('notify', listener);
  }, []);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: Boolean(getAuthToken()),
  });

  const { data: scheduledData } = useQuery({
    queryKey: ['jobs', 'scheduled', 'count'],
    queryFn: () => listScheduledJobs({ page: 1, limit: 1 }),
    refetchInterval: 5000,
    enabled: Boolean(getAuthToken()),
  });

  const { data: sentData } = useQuery({
    queryKey: ['jobs', 'sent', 'count'],
    queryFn: () => listSentJobs({ status: 'sent', page: 1, limit: 1 }),
    refetchInterval: 5000,
    enabled: Boolean(getAuthToken()),
  });

  const { data: failedData } = useQuery({
    queryKey: ['jobs', 'failed', 'count'],
    queryFn: () => listSentJobs({ status: 'failed', page: 1, limit: 1 }),
    refetchInterval: 5000,
    enabled: Boolean(getAuthToken()),
  });

  const { data: sendersData = [] } = useQuery({
    queryKey: ['senders', 'count'],
    queryFn: listSenders,
    refetchInterval: 5000,
    enabled: Boolean(getAuthToken()),
  });

  const scheduledCount = scheduledData?.total ?? 0;
  const sentCount = sentData?.total ?? 0;
  const failedCount = failedData?.total ?? 0;
  const sendersCount = sendersData.length;

  const pathInfo = location.split('?')[0];
  const pages: Record<string, { title: string; subtitle: string }> = {
    '/app/scheduled': { title: 'Scheduled', subtitle: 'Your delivery queue, at a glance.' },
    '/app/sent': { title: 'Sent', subtitle: 'Every message that left the building.' },
    '/app/failed': { title: 'Failed deliveries', subtitle: 'A clear place to resolve delivery friction.' },
    '/app/senders': { title: 'Senders', subtitle: 'Control the identities behind every campaign.' },
    '/app/compose': { title: 'Compose campaign', subtitle: 'Write once. Deliver with intent.' },
  };
  const info = pages[pathInfo] ?? pages['/app/scheduled'];

  const notify = (message: string) => {
    setToasts((current) => [...current.slice(-2), message]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item !== message)), 3200);
  };

  const handleLogout = async () => {
    await logout();
    clearAuthToken();
    setLocation('/');
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'My Account';
  const displayEmail = user?.email || 'Authenticated user';
  const userInitials = (displayName.slice(0, 2)).toUpperCase();

  const nav = [
    { href: '/app/scheduled', label: 'Scheduled', icon: Clock3, count: scheduledCount },
    { href: '/app/sent', label: 'Sent', icon: CheckCircle2, count: sentCount },
    { href: '/app/failed', label: 'Failed', icon: AlertTriangle, count: failedCount },
    { href: '/app/senders', label: 'Senders', icon: UserRound, count: sendersCount },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#fafafa] text-foreground">
      <aside className={cx('fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 transition-transform duration-200 lg:translate-x-0', collapsed ? 'lg:w-[78px]' : '', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className={cx('flex items-center gap-3 px-3', collapsed ? 'lg:justify-center lg:px-0' : '')}>
          <LogoMark />
          <div className={cx('min-w-0', collapsed ? 'lg:hidden' : '')}>
            <p className="truncate text-[13px] font-extrabold tracking-[-.02em]">Email Job Scheduler</p>
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Operations</p>
          </div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden">
            <X size={17} />
          </button>
        </div>
        <div className={cx('mt-8 flex items-center gap-3 rounded-2xl border border-sidebar-border bg-white/65 p-3', collapsed ? 'lg:justify-center lg:border-0 lg:bg-transparent lg:p-0' : '')}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e5c1d6] text-xs font-extrabold text-primary">
            {userInitials}
          </div>
          <div className={cx('min-w-0', collapsed ? 'lg:hidden' : '')}>
            <p className="truncate text-xs font-bold">{displayName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{displayEmail}</p>
          </div>
        </div>
        <Link href="/app/compose" onClick={() => setMobileOpen(false)} className={cx('mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:bg-[#611546]', collapsed ? 'lg:px-0' : '')}>
          <Plus size={17} />
          <span className={collapsed ? 'lg:hidden' : ''}>Compose</span>
        </Link>
        <p className={cx('mb-2 mt-8 px-3 font-mono text-[9px] font-medium uppercase tracking-[.2em] text-muted-foreground', collapsed ? 'lg:hidden' : '')}>Workspace</p>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon, count }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', pathInfo === href ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground', collapsed ? 'lg:justify-center lg:px-0' : '')}>
              <Icon size={17} strokeWidth={pathInfo === href ? 2.4 : 1.8} />
              <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
              <span className={cx('ml-auto rounded-md px-1.5 py-0.5 font-mono text-[10px]', pathInfo === href ? 'bg-white text-primary' : 'bg-sidebar-border/60 text-muted-foreground', collapsed ? 'lg:hidden' : '')}>{count}</span>
            </Link>
          ))}
        </nav>
        <div className={cx('mt-auto rounded-2xl border border-sidebar-border bg-white/45 p-3', collapsed ? 'lg:hidden' : '')}>
          <div className="flex items-center gap-2 text-[10px] font-bold text-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2aa879]" />
            Queue healthy
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">All sender limits are within range.</p>
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="mt-3 hidden items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-sidebar-accent lg:flex">
          {collapsed ? <ArrowRight size={15} /> : <ChevronLeft size={15} />}
          <span className={collapsed ? 'hidden' : ''}>{collapsed ? '' : 'Collapse menu'}</span>
        </button>
      </aside>

      <div className={cx('transition-[padding] duration-200 lg:pl-[258px]', collapsed ? 'lg:pl-[78px]' : '')}>
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border/80 bg-[#fafafa]/85 px-4 backdrop-blur-md sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl border border-border bg-white p-2 text-muted-foreground lg:hidden">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-[-.03em] sm:text-xl">{info.title}</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">{info.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full border border-border bg-white px-3 py-2 text-[11px] font-semibold text-muted-foreground md:flex">
              <span className="mr-2 text-primary">●</span>
              {scheduledCount} scheduled <span className="mx-2 text-border">·</span> {sentCount} sent
            </div>
            <Link href="/app/compose" className="hidden items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground hover:bg-[#611546] sm:flex">
              <Plus size={15} />
              Compose Email
            </Link>
            <button onClick={() => notify('Queue is synchronizing normally')} className="relative rounded-xl border border-border bg-white p-2.5 text-muted-foreground hover:text-primary">
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#2aa879]" />
            </button>
            <div className="relative">
              <button onClick={() => setUserOpen(!userOpen)} className="flex items-center gap-2 rounded-xl border border-border bg-white p-1.5 pr-2.5 cursor-pointer">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e5c1d6] text-[10px] font-extrabold text-primary">
                  {userInitials}
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {userOpen && (
                <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-border bg-white p-1.5 shadow-xl">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Quick links</p>
                  <Link href="/app/senders" onClick={() => setUserOpen(false)} className="block rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">
                    Manage senders
                  </Link>
                  <Link href="/app/scheduled" onClick={() => setUserOpen(false)} className="block rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">
                    Scheduled
                  </Link>
                  <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-xs font-semibold text-destructive cursor-pointer hover:bg-rose-50 rounded-b-xl">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
      <ToastStack messages={toasts} onDismiss={(message) => setToasts((current) => current.filter((item) => item !== message))} />
    </div>
  );
}

function TableToolbar({ title, count, action, onAction, children }: { title: string; count: string; action?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary/70">Delivery records</p>
        <h2 className="mt-1 text-xl font-extrabold tracking-[-.035em]">
          {title} <span className="ml-1 align-middle rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{count}</span>
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action && (
          <button onClick={onAction} className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground hover:bg-[#611546] cursor-pointer">
            <Plus size={15} />
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="font-mono text-[10px] text-muted-foreground">
        Showing page <span className="font-bold text-foreground">{page}</span> of {pages}
      </p>
      <div className="flex gap-1.5">
        <button disabled={page === 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-border bg-white p-2 text-muted-foreground disabled:opacity-35 hover:text-foreground cursor-pointer">
          <ChevronLeft size={15} />
        </button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-border bg-white p-2 text-muted-foreground disabled:opacity-35 hover:text-foreground cursor-pointer">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function JobIdentity({ job }: { job: Job }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f1dce9] font-mono text-[10px] font-medium text-primary">
        {initials(job.email)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-foreground">{job.email}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{job.campaignId || 'Single dispatch'}</p>
      </div>
    </div>
  );
}

function JobActions({ job, onTimeline, onCopy, onCancel }: { job: Job; onTimeline: () => void; onCopy: () => void; onCancel?: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button title="View timeline" onClick={onTimeline} className="rounded-lg p-2 text-muted-foreground hover:bg-[#f8eaf3] hover:text-primary cursor-pointer">
        <Clock3 size={15} />
      </button>
      {onCancel && (
        <button onClick={onCancel} disabled={job.status === 'sending'} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-[#fff0ef] hover:text-destructive disabled:opacity-30 cursor-pointer">
          Cancel
        </button>
      )}
      <button title="Copy job ID" onClick={onCopy} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
        <Copy size={15} />
      </button>
    </div>
  );
}

function ScheduledPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [timelineJob, setTimelineJob] = useState<Job | null>(null);

  const notify = (msg: string) => window.dispatchEvent(new CustomEvent('notify', { detail: msg }));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs', 'scheduled', page],
    queryFn: () => listScheduledJobs({ page, limit: 10 }),
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      notify('Job canceled and removed from queue');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Unable to cancel job');
    },
  });

  const jobs = data?.jobs ?? [];
  const totalPages = data?.totalPages ?? 1;

  const copy = async (id: string) => {
    await navigator.clipboard?.writeText(id);
    notify('Job ID copied to clipboard');
  };

  return (
    <>
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary/70">Queue / outbound</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Scheduled jobs</h2>
          <p className="mt-2 text-sm text-muted-foreground">See what’s next, and keep the queue moving.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#2aa879]" />
          Live queue polling active
        </div>
      </div>
      <TableToolbar title="Up next" count={`${data?.total ?? jobs.length} jobs`} action="Compose" onAction={() => setLocation('/app/compose')}>
        <button onClick={() => refetch()} className="rounded-xl border border-border bg-white p-2.5 text-muted-foreground hover:text-primary cursor-pointer">
          {isLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
        </button>
      </TableToolbar>
      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <EmptyState title="Could not load queue" text="Failed to reach the backend service. Check your connection and try again." action="Retry" onAction={() => refetch()} />
      ) : jobs.length === 0 ? (
        <EmptyState title="No scheduled emails yet" text="Your delivery queue is clear. Compose a campaign when you are ready." action="Compose campaign" onAction={() => setLocation('/app/compose')} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_2px_10px_rgba(35,23,40,.03)]">
          <div className="hidden grid-cols-[1.35fr_1.55fr_1.1fr_.8fr_.55fr_150px] gap-4 border-b border-border bg-[#fcfcfd] px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground lg:grid">
            <span>Recipient</span>
            <span>Campaign subject</span>
            <span>Scheduled time</span>
            <span>Status</span>
            <span>Attempts</span>
            <span className="text-right">Actions</span>
          </div>
          {jobs.map((job) => (
            <div key={job.id} className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[1.35fr_1.55fr_1.1fr_.8fr_.55fr_150px] lg:items-center lg:gap-4">
              <JobIdentity job={job} />
              <div>
                <p className="truncate text-xs font-bold">{job.subject || 'Untitled campaign'}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Queued for delivery</p>
              </div>
              <div>
                <p className="text-xs font-bold">{relative(job.scheduledAt)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{dateTime(job.scheduledAt)}</p>
              </div>
              <div>
                <StatusBadge status={job.status} />
              </div>
              <div className="font-mono text-xs text-muted-foreground">{job.attempts ?? 0}</div>
              <JobActions
                job={job}
                onTimeline={() => setTimelineJob(job)}
                onCopy={() => copy(job.id)}
                onCancel={() => cancelMutation.mutate(job.id)}
              />
            </div>
          ))}
          {totalPages > 1 && <Pagination page={page} pages={totalPages} onPage={setPage} />}
        </div>
      )}
      {timelineJob && <TimelineDialog job={timelineJob} onClose={() => setTimelineJob(null)} />}
    </>
  );
}

function SentPage() {
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [timelineJob, setTimelineJob] = useState<Job | null>(null);
  const [page, setPage] = useState(1);

  const notify = (msg: string) => window.dispatchEvent(new CustomEvent('notify', { detail: msg }));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', 'sent', filter, page],
    queryFn: () => listSentJobs({ status: filter, page, limit: 10 }),
    refetchInterval: 5000,
  });

  const jobs = data?.jobs ?? [];
  const totalPages = data?.totalPages ?? 1;

  const copy = async (id: string) => {
    await navigator.clipboard?.writeText(id);
    notify('Job ID copied to clipboard');
  };

  return (
    <>
      <div className="mb-7">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary/70">History / outbound</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Sent jobs</h2>
        <p className="mt-2 text-sm text-muted-foreground">A searchable pulse check on recent deliveries.</p>
      </div>
      <TableToolbar title="Delivery history" count={`${data?.total ?? jobs.length} jobs`}>
        <div className="flex rounded-xl border border-border bg-white p-1">
          {(['all', 'sent', 'failed'] as const).map((item) => (
            <button
              key={item}
              onClick={() => { setFilter(item); setPage(1); }}
              className={cx('rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.1em] cursor-pointer transition', filter === item ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground')}
            >
              {item}
            </button>
          ))}
        </div>
      </TableToolbar>
      {isLoading ? (
        <PageLoader />
      ) : jobs.length === 0 ? (
        <EmptyState title={`No ${filter} deliveries`} text="Nothing matches this filter yet. Try a different view or send a new campaign." icon={Search} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_2px_10px_rgba(35,23,40,.03)]">
          <div className="hidden grid-cols-[1.22fr_1.35fr_1.05fr_.7fr_.5fr_1.25fr_110px] gap-4 border-b border-border bg-[#fcfcfd] px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground lg:grid">
            <span>Recipient</span>
            <span>Campaign subject</span>
            <span>Sent time</span>
            <span>Status</span>
            <span>Attempts</span>
            <span>Last error</span>
            <span />
          </div>
          {jobs.map((job) => (
            <div key={job.id} className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[1.22fr_1.35fr_1.05fr_.7fr_.5fr_1.25fr_110px] lg:items-center lg:gap-4">
              <JobIdentity job={job} />
              <div>
                <p className="truncate text-xs font-bold">{job.subject || 'Untitled campaign'}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 size={11} className={job.status === 'sent' ? 'text-[#2aa879]' : 'text-muted-foreground'} />
                  Delivery processed
                </p>
              </div>
              <div>
                <p className="text-xs font-bold">{relative(job.sentAt)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{dateTime(job.sentAt)}</p>
              </div>
              <StatusBadge status={job.status} />
              <div className="font-mono text-xs text-muted-foreground">{job.attempts ?? 1}</div>
              <p title={job.lastError ?? ''} className="truncate text-[11px] text-muted-foreground">{job.lastError ?? '—'}</p>
              <JobActions job={job} onTimeline={() => setTimelineJob(job)} onCopy={() => copy(job.id)} />
            </div>
          ))}
          {totalPages > 1 && <Pagination page={page} pages={totalPages} onPage={setPage} />}
        </div>
      )}
      {timelineJob && <TimelineDialog job={timelineJob} onClose={() => setTimelineJob(null)} />}
    </>
  );
}

function FailedPage() {
  const [page, setPage] = useState(1);
  const notify = (msg: string) => window.dispatchEvent(new CustomEvent('notify', { detail: msg }));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', 'failed', page],
    queryFn: () => listSentJobs({ status: 'failed', page, limit: 10 }),
    refetchInterval: 5000,
  });

  const jobs = data?.jobs ?? [];
  const totalPages = data?.totalPages ?? 1;

  const copyError = async (error: string) => {
    await navigator.clipboard?.writeText(error);
    notify('Error copied to clipboard');
  };

  return (
    <>
      <div className="mb-7">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#b1443c]">Attention / needs review</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Failed deliveries</h2>
        <p className="mt-2 text-sm text-muted-foreground">The small set of messages that need a second look.</p>
      </div>
      <TableToolbar title="Needs attention" count={`${data?.total ?? jobs.length} jobs`}>
        <button onClick={() => refetch()} className="rounded-xl border border-border bg-white p-2.5 text-muted-foreground hover:text-primary cursor-pointer">
          <RefreshCw size={16} />
        </button>
      </TableToolbar>
      {isLoading ? (
        <PageLoader />
      ) : jobs.length === 0 ? (
        <EmptyState title="No failed deliveries right now" text="Nice work. We’ll surface delivery issues here when they happen." icon={CheckCircle2} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_2px_10px_rgba(35,23,40,.03)]">
          <div className="hidden grid-cols-[1.2fr_2fr_.6fr_1fr_100px] gap-4 border-b border-border bg-[#fcfcfd] px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground lg:grid">
            <span>Recipient</span>
            <span>Last error</span>
            <span>Attempts</span>
            <span>Scheduled at</span>
            <span />
          </div>
          {jobs.map((job) => (
            <div key={job.id} className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[1.2fr_2fr_.6fr_1fr_100px] lg:items-center lg:gap-4">
              <JobIdentity job={job} />
              <p title={job.lastError ?? ''} className="max-w-lg text-xs leading-5 text-[#7f4541]">
                {job.lastError || 'Delivery failure'}
              </p>
              <span className="font-mono text-xs text-muted-foreground">{job.attempts ?? 1} attempts</span>
              <span className="text-xs text-muted-foreground">{dateTime(job.scheduledAt ?? job.sentAt)}</span>
              <button onClick={() => copyError(job.lastError ?? 'Unknown error')} className="flex items-center gap-1.5 justify-self-start rounded-lg border border-border px-2.5 py-2 text-[10px] font-bold text-muted-foreground hover:border-primary/30 hover:text-primary cursor-pointer">
                <Copy size={13} />
                Copy error
              </button>
            </div>
          ))}
          {totalPages > 1 && <Pagination page={page} pages={totalPages} onPage={setPage} />}
        </div>
      )}
    </>
  );
}

function AddSenderDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (payload: { name: string; email: string }) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const submit = () => {
    if (!name.trim() || !email.includes('@')) return;
    onAdd({ name: name.trim(), email: email.trim() });
    onClose();
  };

  return (
    <Dialog title="Add a sender" eyebrow="Identity / new" onClose={onClose}>
      <p className="mb-5 text-sm leading-6 text-muted-foreground">Add a verified sender identity to use in campaigns.</p>
      <label className="mb-3 block text-xs font-bold">
        Display name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Support Team"
          className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <label className="block text-xs font-bold">
        Sender email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="support@domain.com"
          className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <div className="mt-7 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer">
          Cancel
        </button>
        <button onClick={submit} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-[#611546] cursor-pointer">
          Add sender
        </button>
      </div>
    </Dialog>
  );
}

function Dialog({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#25121f]/35 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cx('max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-border bg-white p-6 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')} role="dialog" aria-modal="true">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary/70">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-.035em]">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
            <X size={17} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function TimelineDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const iconMap: Record<TimelineEventType, typeof Mail> = {
    campaign_created: Mail,
    campaign_scheduled: CalendarClock,
    job_scheduled: Clock3,
    job_sending: Send,
    job_sent: CheckCircle2,
    job_failed: AlertTriangle,
    rate_limited: Gauge,
    job_retry: RotateCcw,
  };
  const labelMap: Record<TimelineEventType, string> = {
    campaign_created: 'Campaign created',
    campaign_scheduled: 'Campaign scheduled',
    job_scheduled: 'Job scheduled',
    job_sending: 'Job sending',
    job_sent: 'Job sent',
    job_failed: 'Job failed',
    rate_limited: 'Rate limited',
    job_retry: 'Job retry',
  };

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['campaign-timeline', job.campaignId],
    queryFn: () => job.campaignId ? getCampaignTimeline(job.campaignId) : Promise.resolve([]),
    enabled: Boolean(job.campaignId),
  });

  return (
    <Dialog title="Campaign timeline" eyebrow={`${job.id} / event stream`} onClose={onClose} wide>
      <div className="mb-5 rounded-2xl bg-muted/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1dce9] text-primary">
            <Mail size={16} />
          </div>
          <div>
            <p className="text-xs font-bold">{job.subject}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{job.email} · {job.campaignId}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={job.status} />
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading timeline events…</div>
      ) : events.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No timeline events recorded yet.</div>
      ) : (
        <div className="space-y-0">
          {events.map((event, index) => {
            const Icon = iconMap[event.type] || Clock3;
            return (
              <div key={`${event.type}-${index}`} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="relative flex w-8 shrink-0 justify-center">
                  <span className={cx('z-10 grid h-8 w-8 place-items-center rounded-xl border', event.type === 'job_failed' ? 'border-[#f3c4c0] bg-[#fff0ef] text-destructive' : event.type === 'job_sent' ? 'border-[#bce8d5] bg-[#eaf7f1] text-[#25815d]' : 'border-[#e7d0dd] bg-[#f8eaf3] text-primary')}>
                    <Icon size={14} />
                  </span>
                  {index < events.length - 1 && <span className="absolute top-8 h-full w-px bg-border" />}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold">{labelMap[event.type] || event.type}</p>
                    <time className="font-mono text-[10px] text-muted-foreground">{dateTime(event.at)}</time>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

function SendersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [deleting, setDeleting] = useState<Sender | null>(null);

  const notify = (msg: string) => window.dispatchEvent(new CustomEvent('notify', { detail: msg }));

  const { data: senders = [], isLoading, refetch } = useQuery({
    queryKey: ['senders'],
    queryFn: listSenders,
  });

  const createMutation = useMutation({
    mutationFn: createSender,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      notify('Sender added to your workspace');
      setName('');
      setEmail('');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Failed to add sender');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSender,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      notify('Sender removed');
      setDeleting(null);
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Failed to remove sender');
    },
  });

  const visible = senders.filter((sender) => `${sender.name} ${sender.email}`.toLowerCase().includes(query.toLowerCase()));

  const inlineAdd = () => {
    if (!name.trim() || !email.includes('@')) return;
    createMutation.mutate({ name: name.trim(), email: email.trim() });
  };

  return (
    <>
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary/70">Workspace / identities</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Senders</h2>
          <p className="mt-2 text-sm text-muted-foreground">The people and addresses your campaigns speak through.</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 self-start rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs font-bold text-muted-foreground hover:text-primary cursor-pointer">
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="mb-7 grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-[0_2px_10px_rgba(35,23,40,.03)] md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-xs font-bold">
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Support Team"
            className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-bold">
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="support@domain.com"
            className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          onClick={inlineAdd}
          disabled={createMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground hover:bg-[#611546] disabled:opacity-50 cursor-pointer"
        >
          {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Add sender
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search senders"
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>
        <button onClick={() => setDialog(true)} className="ml-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-[#f8eaf3] px-3.5 py-2.5 text-xs font-bold text-primary hover:bg-[#f2deeb] cursor-pointer">
          <Plus size={15} />
          Add sender
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : visible.length === 0 ? (
        <EmptyState title="No senders found" text="Try a different search or add a new sender identity." icon={UserRound} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((sender) => (
            <div key={sender.id} className="group rounded-2xl border border-border bg-white p-5 shadow-[0_2px_10px_rgba(35,23,40,.03)] transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f1dce9] text-sm font-extrabold text-primary">
                  {sender.name.split(' ').map((s) => s[0]).join('').slice(0, 2) || 'S'}
                </div>
                <button onClick={() => setDeleting(sender)} className="rounded-lg p-2 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-[#fff0ef] hover:text-destructive cursor-pointer">
                  <Trash2 size={15} />
                </button>
              </div>
              <h3 className="mt-5 text-sm font-extrabold">{sender.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{sender.email}</p>
              <div className="mt-5 flex items-center gap-2 border-t border-border pt-3 text-[10px] font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2aa879]" />
                Verified sender
                <span className="ml-auto font-mono">{dateTime(sender.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <AddSenderDialog
          onClose={() => setDialog(false)}
          onAdd={(payload) => createMutation.mutate(payload)}
        />
      )}

      {deleting && (
        <Dialog title="Delete sender?" eyebrow="Identity / remove" onClose={() => setDeleting(null)}>
          <p className="text-sm leading-6 text-muted-foreground">
            Remove <strong className="text-foreground">{deleting.email}</strong> from your workspace? Existing delivery records will remain intact.
          </p>
          <div className="mt-7 flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer">
              Keep sender
            </button>
            <button
              onClick={() => deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              className="rounded-xl bg-destructive px-4 py-2.5 text-xs font-bold text-destructive-foreground cursor-pointer"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete sender'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function ComposePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser });
  const { data: senders = [] } = useQuery({ queryKey: ['senders'], queryFn: listSenders });

  const [senderId, setSenderId] = useState('');
  const [addSender, setAddSender] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [raw, setRaw] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [tab, setTab] = useState<'paste' | 'csv'>('paste');
  const [showAll, setShowAll] = useState(false);
  const [snippet, setSnippet] = useState('Intro + context');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [delay, setDelay] = useState(2);
  const [hourly, setHourly] = useState(200);
  const [preview, setPreview] = useState(false);
  const [testing, setTesting] = useState(false);
  const [draft, setDraft] = useState(false);

  useEffect(() => {
    if (!senderId && senders.length > 0) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('outbox.draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.subject || parsed.body || parsed.recipients?.length) {
          setSubject(parsed.subject || '');
          setBody(parsed.body || '');
          if (Array.isArray(parsed.recipients)) {
            setRecipients(parsed.recipients);
            setRaw(parsed.recipients.join('\n'));
          }
          if (parsed.senderId) setSenderId(parsed.senderId);
          setDraft(true);
        }
      }
    } catch {
      // ignore draft parse error
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (subject || body || recipients.length) {
        localStorage.setItem('outbox.draft', JSON.stringify({ subject, body, recipients, senderId }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [subject, body, recipients, senderId]);

  const notify = (msg: string) => window.dispatchEvent(new CustomEvent('notify', { detail: msg }));

  const applyEmails = () => {
    const parsed = raw.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
    const unique = [...new Set(parsed)];
    const good = unique.filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
    setRecipients(good);
    setInvalid(unique.filter((item) => !good.includes(item)));
    notify(`${good.length} recipients ready`);
  };

  const handleCsvFile = async (file: File) => {
    try {
      const result = await validateCsvFile(file);
      setRecipients(result.valid);
      setInvalid(result.invalid);
      setRaw(result.valid.join('\n'));
      notify(`${result.valid.length} valid recipients extracted from CSV`);
    } catch {
      const text = await file.text();
      const parsed = text.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
      const unique = [...new Set(parsed)];
      const good = unique.filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
      setRecipients(good);
      setInvalid(unique.filter((item) => !good.includes(item)));
      setRaw(good.join('\n'));
      notify(`${good.length} recipients loaded from file`);
    }
  };

  const insertSnippet = () => {
    const texts: Record<string, string> = {
      'Intro + context': 'Hi there,\n\nI hope you are doing well. I wanted to share a quick update regarding...\n\n',
      'Follow-up': 'Following up on our earlier conversation.\n\n',
      'Call-to-action': 'Would you have 10 minutes this week for a brief walkthrough?\n\n',
      'Signature': '\nBest regards,\nOperations Team',
    };
    setBody((current) => `${current}${current.endsWith('\n') ? '' : '\n\n'}${texts[snippet] || ''}`);
    notify('Snippet inserted into body');
  };

  const scheduleMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      localStorage.removeItem('outbox.draft');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      notify('Campaign scheduled successfully');
      setLocation('/app/scheduled');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Failed to schedule campaign');
    },
  });

  const handleSchedule = () => {
    if (!senderId) {
      notify('Please select a sender');
      return;
    }
    if (recipients.length === 0) {
      notify('Please add at least one recipient');
      return;
    }
    if (!subject.trim()) {
      notify('Please enter a subject');
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours || 0, minutes || 0, 0, 0);

    scheduleMutation.mutate({
      senderId,
      subject,
      body,
      recipients,
      scheduledStartAt: scheduledDate.toISOString(),
      delayBetweenEmails: delay * 1000,
      hourlyLimit: hourly,
    });
  };

  const handleTest = async () => {
    if (!user?.email) {
      notify('Unable to send test: no user email found');
      return;
    }
    if (!senderId) {
      notify('Please select a sender first');
      return;
    }
    if (!subject.trim()) {
      notify('Please enter a subject');
      return;
    }

    setTesting(true);
    try {
      await createCampaign({
        senderId,
        subject: `[TEST] ${subject}`,
        body,
        recipients: [user.email],
        scheduledStartAt: new Date().toISOString(),
        delayBetweenEmails: 0,
        hourlyLimit: 100,
      });
      notify(`Test email scheduled to ${user.email}`);
    } catch (err: any) {
      notify(err?.response?.data?.message || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const createSenderMutation = useMutation({
    mutationFn: createSender,
    onSuccess: (newSender) => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      setSenderId(newSender.id);
      notify('Sender added and selected');
    },
  });

  return (
    <>
      {draft && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#ead9e3] bg-[#fffafd] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f4dfeb] text-primary">
              <Sparkles size={15} />
            </div>
            <div>
              <p className="text-xs font-extrabold">Draft restored from your last session</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Autosaved · changes stay local until scheduled</p>
            </div>
          </div>
          <button
            onClick={() => {
              setDraft(false);
              setSubject('');
              setBody('');
              setRecipients([]);
              setRaw('');
              localStorage.removeItem('outbox.draft');
              notify('Draft discarded');
            }}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Discard draft
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_2px_10px_rgba(35,23,40,.03)]">
            <SectionHeader number="01" title="Sender" note="Who is this from?" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1 text-xs font-bold">
                Sending identity
                <select
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {senders.length === 0 && <option value="">No senders found — add one first</option>}
                  {senders.map((sender) => (
                    <option key={sender.id} value={sender.id}>
                      {sender.name} ({sender.email})
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => setAddSender(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-[#f8eaf3] px-3 py-2.5 text-xs font-bold text-primary cursor-pointer">
                <Plus size={14} />
                Add sender
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_2px_10px_rgba(35,23,40,.03)]">
            <SectionHeader number="02" title="Recipients" note={`${recipients.length} people in this delivery`} />
            <div className="mb-4 flex w-fit rounded-xl border border-border bg-muted/50 p-1">
              {(['paste', 'csv'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={cx('flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer transition', tab === item ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}
                >
                  {item === 'paste' ? <FileText size={14} /> : <Upload size={14} />}
                  {item === 'paste' ? 'Paste list' : 'Upload CSV'}
                </button>
              ))}
            </div>

            {tab === 'paste' ? (
              <div>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={5}
                  placeholder="one@email.com&#10;another@email.com"
                  className="w-full resize-none rounded-xl border border-input bg-[#fcfcfd] p-3 font-mono text-xs leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <button onClick={applyEmails} className="mt-3 rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs font-bold text-foreground hover:border-primary/30 cursor-pointer">
                  Apply emails
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-[#fffafd] px-4 py-10 text-center">
                <Upload size={21} className="mb-2 text-primary" />
                <span className="text-xs font-bold">Drop a CSV here or <span className="text-primary underline">browse</span></span>
                <span className="mt-1 text-[10px] text-muted-foreground">One email per row · .csv file</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCsvFile(file);
                  }}
                />
              </label>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center">
              <div>
                <p className="font-mono text-sm font-medium">{recipients.length + invalid.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[.1em] text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="font-mono text-sm font-medium text-destructive">{invalid.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[.1em] text-muted-foreground">Invalid</p>
              </div>
              <div>
                <p className="font-mono text-sm font-medium text-[#25815d]">
                  {Math.max(0, raw.split(/[\n,;]+/).filter(Boolean).length - (recipients.length + invalid.length))}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[.1em] text-muted-foreground">Duplicates removed</p>
              </div>
            </div>

            {recipients.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {recipients.slice(0, showAll ? undefined : 6).map((email) => (
                  <span key={email} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {email}
                    <button onClick={() => setRecipients((items) => items.filter((item) => item !== email))} className="text-muted-foreground hover:text-destructive cursor-pointer">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {recipients.length > 6 && (
                  <button onClick={() => setShowAll(!showAll)} className="rounded-lg px-2 py-1 text-[10px] font-bold text-primary cursor-pointer">
                    {showAll ? 'Show less' : `+${recipients.length - 6} more`}
                  </button>
                )}
              </div>
            )}

            {invalid.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#f4d0cc] bg-[#fff8f7] p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#a54840]">
                  <AlertCircle size={14} />
                  {invalid.length} invalid address{invalid.length > 1 ? 'es' : ''}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {invalid.map((email) => (
                    <span key={email} className="rounded-md bg-[#ffe6e3] px-2 py-1 font-mono text-[10px] text-[#a54840]">
                      {email}
                    </span>
                  ))}
                </div>
                <button onClick={() => setInvalid([])} className="self-start text-[10px] font-bold text-[#a54840] underline cursor-pointer">
                  Remove invalids
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_2px_10px_rgba(35,23,40,.03)]">
            <SectionHeader number="03" title="Content" note="Give your message a reason to be opened." />
            <label className="block text-xs font-bold">
              Subject
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="min-w-0 flex-1 rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <span className={cx('font-mono text-[10px]', subject.length > 78 ? 'text-destructive' : 'text-muted-foreground')}>
                  {subject.length}/78
                </span>
              </div>
            </label>
            {subject.length > 78 && (
              <p className="mt-2 flex items-center gap-1 text-[10px] text-destructive">
                <AlertTriangle size={12} />
                Long subjects can be truncated on mobile inboxes.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1 text-xs font-bold">
                Snippet
                <select
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-xs outline-none focus:border-primary"
                >
                  {['Intro + context', 'Follow-up', 'Call-to-action', 'Signature'].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <button onClick={insertSnippet} className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs font-bold hover:border-primary/30 cursor-pointer">
                Insert
              </button>
            </div>

            <label className="mt-5 block text-xs font-bold">
              Body
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Write your email body here..."
                className="mt-1.5 w-full resize-none rounded-xl border border-input p-3 text-sm leading-6 outline-none focus:border-primary"
              />
            </label>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{body.length} characters</span>
              <button onClick={() => setPreview(true)} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer">
                <Mail size={14} />
                Email Preview
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_2px_10px_rgba(35,23,40,.03)]">
            <SectionHeader number="04" title="Schedule" note="Set the delivery rules." />
            <label className="mt-5 block text-xs font-bold">
              Start date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="mt-4 block text-xs font-bold">
              Start time
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <p className="flex items-center gap-2 text-xs font-bold">
                <Clock3 size={14} className="text-primary" />
                Schedule Target
              </p>
              <p className="mt-1 pl-5 text-[10px] text-muted-foreground">{date} at {time}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">
                Delay / sec
                <input
                  type="number"
                  min="0"
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
              <label className="text-xs font-bold">
                Hourly limit
                <input
                  type="number"
                  min="1"
                  value={hourly}
                  onChange={(e) => setHourly(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-primary/15 bg-[#fffafd] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary/70">Ready to send</p>
            <p className="mt-2 text-xl font-extrabold tracking-[-.04em]">{recipients.length} recipients ready</p>
            <p className="mt-1 text-xs text-muted-foreground">
              From {senders.find((s) => s.id === senderId)?.email || 'Select a sender'}
            </p>
            <button
              onClick={handleTest}
              disabled={testing || !subject.trim() || !senderId}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-xs font-extrabold text-foreground hover:border-primary/30 disabled:opacity-50 cursor-pointer"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send test to me
            </button>
            <button
              onClick={handleSchedule}
              disabled={scheduleMutation.isPending || recipients.length === 0 || !subject.trim() || !senderId}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground hover:bg-[#611546] disabled:opacity-50 cursor-pointer"
            >
              {scheduleMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Scheduling campaign…
                </>
              ) : (
                <>
                  Schedule campaign
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </section>
        </aside>
      </div>

      {addSender && (
        <AddSenderDialog
          onClose={() => setAddSender(false)}
          onAdd={(payload) => createSenderMutation.mutate(payload)}
        />
      )}

      {preview && (
        <Dialog title="Email preview" eyebrow="Rendering / inbox view" onClose={() => setPreview(false)}>
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="border-b border-border bg-[#fcfcfd] p-4">
              <p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">Subject</p>
              <p className="mt-1 text-sm font-extrabold">{subject || 'Untitled campaign'}</p>
            </div>
            <div className="p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{body || 'Your message is empty.'}</p>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

function SectionHeader({ number, title, note }: { number: string; title: string; note: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="font-mono text-[10px] font-medium text-primary/70">{number}</span>
      <div>
        <h3 className="text-sm font-extrabold">{title}</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function DashboardRouter() {
  return (
    <AppShell>
      <Switch>
        <Route path="/app/scheduled" component={ScheduledPage} />
        <Route path="/app/sent" component={SentPage} />
        <Route path="/app/failed" component={FailedPage} />
        <Route path="/app/senders" component={SendersPage} />
        <Route path="/app/compose" component={ComposePage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/app/:rest*" component={DashboardRouter} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
