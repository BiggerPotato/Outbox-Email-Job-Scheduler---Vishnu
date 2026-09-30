import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Render the NotFound component. */
export default function NotFound() {
  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm ">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="heading-font mt-3 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/">Go to login</Link>
        </Button>
      </div>
    </div>
  );
}

