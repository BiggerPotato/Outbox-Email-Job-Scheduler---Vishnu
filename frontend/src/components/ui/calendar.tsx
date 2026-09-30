import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils/cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rounded-2xl bg-slate-900/5 p-3 shadow-sm dark:bg-slate-900/30', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'space-y-4',
        caption: 'flex items-center justify-between',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        nav_button: 'h-8 w-8 rounded-full border border-border bg-white text-sm hover:bg-muted',
        table: 'w-full border-collapse',
        head_row: 'flex',
        head_cell: 'w-9 text-center text-xs text-muted-foreground',
        row: 'mt-2 flex w-full',
        cell: 'relative h-9 w-9 text-center text-sm',
        day: 'h-9 w-9 rounded-full hover:bg-muted',
        day_selected: 'bg-[#7b1b5a] text-white hover:bg-[#6a184f]',
        day_today: 'border border-[#7b1b5a]',
        day_outside: 'text-muted-foreground/60',
        day_disabled: 'text-muted-foreground/40',
        ...classNames
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
