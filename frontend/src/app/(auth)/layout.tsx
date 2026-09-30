/** Render the AuthLayout component. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="page-shell flex min-h-screen items-center justify-center px-6 py-12">{children}</div>;
}
