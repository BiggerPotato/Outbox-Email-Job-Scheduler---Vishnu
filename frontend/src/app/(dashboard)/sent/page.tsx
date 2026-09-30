import { redirect } from 'next/navigation';

/** Render the SentRedirect component. */
export default function SentRedirect() {
  redirect('/app/sent');
}
