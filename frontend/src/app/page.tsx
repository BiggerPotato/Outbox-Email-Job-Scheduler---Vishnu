import { redirect } from 'next/navigation';
import LoginPageClient from '@/components/auth/login-page-client';

/** Render the LoginPage component. */
export default function LoginPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    redirect('/app/compose');
  }

  return <LoginPageClient />;
}
