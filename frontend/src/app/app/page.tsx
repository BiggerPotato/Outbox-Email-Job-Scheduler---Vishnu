'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import ScheduledTable from '@/components/jobs/scheduled-table';
import SentTable from '@/components/jobs/sent-table';
import { listScheduledJobs, listSentJobs } from '@/lib/api/jobs';
import { cn } from '@/lib/utils/cn';
import { usePageVisibility } from '@/lib/hooks/use-page-visibility';

const tabs = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sent', label: 'Sent' }
];

/** Render the AppIndex component. */
export default function AppIndex() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const isVisible = usePageVisibility();
  const { data: scheduled } = useQuery({
    queryKey: ['jobs', 'scheduled', 'tab'],
    queryFn: () => listScheduledJobs({ page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });
  const { data: sent } = useQuery({
    queryKey: ['jobs', 'sent', 'tab'],
    queryFn: () => listSentJobs({ page: 1, limit: 1 }),
    staleTime: 5000,
    refetchInterval: isVisible ? 5000 : false, // Poll while visible.
    refetchOnWindowFocus: true
  });

  const scheduledCount = scheduled?.total ?? 0;
  const sentCount = sent?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            const count = tab.id === 'scheduled' ? scheduledCount : sentCount;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'scheduled' | 'sent')}
                className={cn(
                  'relative flex items-center gap-3 overflow-hidden rounded-lg px-5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border border-[#e7c6d9] bg-[#f7e9f1] text-[#7b1b5a]'
                    : 'border border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="activeTab"
                    className="absolute bottom-1 left-1 top-1 w-1 rounded-full bg-[#7b1b5a]"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                {tab.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn(activeTab === 'scheduled' ? 'block' : 'hidden')}>
        <ScheduledTable />
      </div>
      <div className={cn(activeTab === 'sent' ? 'block' : 'hidden')}>
        <SentTable />
      </div>
    </div>
  );
}
