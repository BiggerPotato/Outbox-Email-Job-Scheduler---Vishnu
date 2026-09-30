import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ''
    })
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && account.id_token) {
        try {
          const response = await fetch(`${apiUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: account.id_token })
          });

          if (response.ok) {
            const data = await response.json();
            token.backendToken = data.token ?? data.accessToken ?? data.jwt;
            token.user = data.user ?? {
              name: profile?.name ?? token.name,
              email: profile?.email ?? token.email,
              image: profile?.picture ?? token.picture
            };
          }
        } catch {
          // Keep Google session even if backend is unavailable.
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = (token.user as typeof session.user) ?? session.user;
      session.backendToken = token.backendToken as string | undefined;
      return session;
    }
  },
  pages: {
    signIn: '/login'
  }
});
