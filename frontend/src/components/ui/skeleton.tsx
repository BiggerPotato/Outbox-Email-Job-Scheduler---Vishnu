import { cn } from '@/lib/utils/cn';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/60 before:absolute before:inset-0 before:-translate-x-full before:content-[''] before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] before:animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
