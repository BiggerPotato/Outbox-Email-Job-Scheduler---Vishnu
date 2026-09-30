import { redirect } from 'next/navigation';

/** Render the ScheduledRedirect component. */
export default function ScheduledRedirect() {
  redirect('/app/scheduled');
}
