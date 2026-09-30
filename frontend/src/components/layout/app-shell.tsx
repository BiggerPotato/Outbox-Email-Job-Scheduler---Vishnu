'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/layout/sidebar';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useRequireAuth } from '@/lib/auth/guard';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

/** Render the AppShell component. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useRequireAuth('/login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(true);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm ">
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-6 py-8">
        <motion.div
          className="relative shrink-0 overflow-hidden"
          animate={{ width: sidebarOpen ? 280 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        >
          <Sidebar />
        </motion.div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setSidebarOpen((open) => !open)}>
              <Menu className="h-4 w-4" />
              {sidebarOpen ? 'Hide menu' : 'Show menu'}
            </Button>
          </div>
          <DashboardHeader />
          {children}
        </div>
      </div>
    </div>
  );
}

