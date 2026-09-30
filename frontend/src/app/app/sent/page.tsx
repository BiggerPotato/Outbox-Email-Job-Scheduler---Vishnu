import SentTable from '@/components/jobs/sent-table';

/** Render the SentPage component. */
export default function SentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-font text-2xl font-semibold">Sent</h1>
        <p className="text-sm text-muted-foreground">Delivered messages and delivery history.</p>
      </div>
      <SentTable />
    </div>
  );
}
