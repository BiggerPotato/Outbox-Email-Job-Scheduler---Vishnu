import ScheduledTable from '@/components/jobs/scheduled-table';

/** Render the ScheduledPage component. */
export default function ScheduledPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-font text-2xl font-semibold">Scheduled</h1>
        <p className="text-sm text-muted-foreground">Queued or rescheduled emails awaiting delivery.</p>
      </div>
      <ScheduledTable />
    </div>
  );
}
