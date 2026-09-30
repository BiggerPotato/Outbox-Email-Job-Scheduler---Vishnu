import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
    <textarea
      className={cn(
        'flex min-h-[120px] w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted',
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
);
Textarea.displayName = 'Textarea';

export { Textarea };

