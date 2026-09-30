import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import '@fontsource/ibm-plex-sans/latin.css';
import { Providers } from '@/components/providers';
import TopLoader from '@/components/shared/top-loader';

export const metadata: Metadata = {
  title: 'Email Job Scheduler',
  description: 'Schedule personalized email campaigns with confidence.'
};

/** Render the RootLayout component. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Suspense fallback={null}>
            <TopLoader />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
