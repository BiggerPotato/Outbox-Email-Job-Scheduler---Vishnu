import { redirect } from 'next/navigation';

/** Render the DashboardHome component. */
export default function DashboardHome() {
  redirect('/app/compose');
}
