import { Skeleton } from '@/components/ui/skeleton';

/** Render the JobsSkeleton component. */
export default function JobsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-white px-5 py-4"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

