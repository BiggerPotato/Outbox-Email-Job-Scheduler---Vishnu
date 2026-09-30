'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

const tabs = [
  { href: '/scheduled', label: 'Scheduled' },
  { href: '/sent', label: 'Sent' }
];

/** Render the DashboardTabs component. */
export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-xl bg-muted/40 p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-5 py-2 text-sm font-medium transition-colors',
              active
                ? 'border border-[#e7c6d9] bg-[#f7e9f1] text-[#7b1b5a]'
                : 'border border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {active && (
              <motion.span
                layoutId="dashboardTab"
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-[#7b1b5a]"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
