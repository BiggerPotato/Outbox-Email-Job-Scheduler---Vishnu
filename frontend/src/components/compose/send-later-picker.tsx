'use client';

import { addDays, setHours, setMinutes } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SendLaterPickerProps {
  date: Date;
  time: string;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: string) => void;
}

/** Render the SendLaterPicker component. */
export default function SendLaterPicker({ date, time, onDateChange, onTimeChange }: SendLaterPickerProps) {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';

  const quickOptions = [
    { label: 'Tomorrow 10am', date: setMinutes(setHours(addDays(new Date(), 1), 10), 0) },
    { label: 'Tomorrow 11am', date: setMinutes(setHours(addDays(new Date(), 1), 11), 0) },
    { label: 'Tomorrow 3pm', date: setMinutes(setHours(addDays(new Date(), 1), 15), 0) }
  ];

  return (
    <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Send Later</p>
        <h3 className="heading-font text-lg font-semibold">Choose schedule</h3>
      </div>
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Date</label>
        <Calendar mode="single" selected={date} onSelect={(value) => value && onDateChange(value)} />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Time</label>
        <div className="flex items-center gap-2">
          <Input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
          <span className="rounded-full border border-border bg-muted px-3 py-2 text-xs font-semibold">
            {period}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick Options</p>
        <div className="flex flex-wrap gap-2">
          {quickOptions.map((option) => (
            <Button
              key={option.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onDateChange(option.date);
                onTimeChange(`${String(option.date.getHours()).padStart(2, '0')}:${String(option.date.getMinutes()).padStart(2, '0')}`);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => onDateChange(new Date())}>
          Cancel
        </Button>
        <Button type="button" className="flex-1">
          Done
        </Button>
      </div>
    </div>
  );
}

