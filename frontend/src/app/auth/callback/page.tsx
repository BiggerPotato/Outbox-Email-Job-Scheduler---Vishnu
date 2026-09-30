import { Suspense } from 'react';
import CallbackClient from './callback-client';

function CallbackFallback() {
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

/** Render the AuthCallbackPage component. */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackClient />
    </Suspense>
  );
}

