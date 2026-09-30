import AppShell from '@/components/layout/app-shell';

/** Render the AppLayout component. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
