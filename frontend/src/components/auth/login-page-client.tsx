'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { getAuthToken } from '@/lib/auth/token';
import { CalendarClock, Mail, ShieldCheck, TimerReset } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M22.5 12.27c0-.73-.06-1.47-.2-2.18H12v4.12h5.92a5.1 5.1 0 0 1-2.2 3.34v2.77h3.55c2.08-1.91 3.23-4.73 3.23-8.05Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.47-.98 7.3-2.68l-3.55-2.77c-.98.67-2.24 1.05-3.75 1.05-2.88 0-5.32-1.94-6.19-4.55H2.14v2.86A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.81 14.05a6.6 6.6 0 0 1 0-4.1V7.09H2.14a11 11 0 0 0 0 9.82l3.67-2.86Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.4c1.62 0 3.07.56 4.22 1.64l3.12-3.12C17.47 2.19 14.97 1 12 1 7.62 1 3.74 3.48 2.14 7.1l3.67 2.86C6.68 7.35 9.12 5.4 12 5.4Z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Render the LoginPage component. */
export default function LoginPageClient() {
  const router = useRouter();
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.BACKEND_URL ??
    'http://127.0.0.1:3001';
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 120, damping: 20 });

  useEffect(() => {
    if (getAuthToken()) {
      router.replace('/app/compose');
    }
  }, [router]);

  const features = [
    {
      title: 'Precision scheduling',
      description: 'Queue messages with controlled spacing and retries.',
      icon: CalendarClock
    },
    {
      title: 'Per-sender rate limits',
      description: 'Protect deliverability with hourly caps.',
      icon: ShieldCheck
    },
    {
      title: 'Live delivery timeline',
      description: 'Track queued, sending, and completed jobs.',
      icon: TimerReset
    }
  ];

  return (
    <div className="page-shell grid min-h-screen grid-cols-1 lg:grid-cols-[2fr_3fr]">
      <motion.section
        className="relative hidden overflow-hidden lg:flex"
        onMouseMove={(event) => {
          const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
          mouseX.set((event.clientX - left - width / 2) / 25);
          mouseY.set((event.clientY - top - height / 2) / 25);
        }}
        style={{ x: smoothX, y: smoothY }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#2b0f1f] via-[#4a1636] to-[#7b1b5a]" />
        <div className="absolute inset-0 opacity-35">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:48px_48px] animate-grid-pan" />
        </div>
        <div className="relative z-10 flex w-full flex-col justify-between p-12 text-white">
          <div className="space-y-6">
            <div>
              <h1 className="heading-font text-balance text-4xl font-semibold">
                Email Job Scheduler
              </h1>
              <p className="mt-3 text-lg text-white/80">
                Schedule emails at scale. Reliably.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="text-xs text-white/70">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <section className="flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg rounded-3xl border border-border/60 bg-white p-10 shadow-[0_12px_50px_rgba(15,23,42,0.12)]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2b0f1f] text-white">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Welcome</p>
              <h2 className="heading-font text-2xl font-semibold">Sign in</h2>
            </div>
          </div>

          <motion.button
            whileHover={{ y: -1, boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}
            whileTap={{ y: 1 }}
            transition={{ duration: 0.15 }}
            className="group relative mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setRipple({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                key: Date.now()
              });
              window.location.href = `${backendUrl}/api/auth/google`;
            }}
          >
            <GoogleIcon />
            Continue with Google
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  'linear-gradient(90deg, rgba(123,27,90,0) 0%, rgba(123,27,90,0.15) 50%, rgba(123,27,90,0) 100%)'
              }}
            />
            {ripple && (
              <motion.span
                key={ripple.key}
                className="pointer-events-none absolute h-12 w-12 rounded-full bg-[#7b1b5a]/10"
                style={{ left: ripple.x - 24, top: ripple.y - 24 }}
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}
          </motion.button>
        </motion.div>
      </section>
    </div>
  );
}
