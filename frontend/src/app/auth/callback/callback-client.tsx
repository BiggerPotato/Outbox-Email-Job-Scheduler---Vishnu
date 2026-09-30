'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { setAuthToken } from '@/lib/auth/token';

/** Render the CallbackClient component. */
export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setAuthToken(token);
      router.replace('/app/compose');
    } else {
      setMissing(true);
    }
  }, [router, searchParams]);

  if (missing) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm ">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Auth Error</p>
          <h1 className="heading-font mt-3 text-2xl font-semibold">Missing token</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We could not complete sign-in. Please try again.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href="/">Back to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm ">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signing you in</p>
        <h1 className="heading-font mt-3 text-2xl font-semibold">Redirecting...</h1>
        <p className="mt-3 text-sm text-muted-foreground">Finalizing your session.</p>
      </div>
    </div>
  );
}

