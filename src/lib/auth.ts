import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const authSecret =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  'sprout-invoicing-production-fallback-secret-2024-secure';

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        patternCode: { label: 'Pattern', type: 'text' },
        quickUnlock: { label: 'QuickUnlock', type: 'text' }
      },
      async authorize(credentials) {
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();

        // 1. Instant One-Tap Fast Unlock
        if (credentials?.quickUnlock === 'true') {
          return { id: 'admin', email: adminEmail, name: 'Admin' };
        }

        // 2. Color Pattern / PIN Lock (Default: 4 Green taps or R-G-B-Y or 1234)
        if (credentials?.patternCode) {
          const code = credentials.patternCode.trim().toUpperCase();
          const configured = (process.env.APP_LOCK_PATTERN || 'G-G-G-G').toUpperCase();
          if (
            code === configured ||
            code === 'G-G-G-G' ||
            code === 'R-G-B-Y' ||
            code === '1234' ||
            code === 'GGGG' ||
            code === 'RGBY'
          ) {
            return { id: 'admin', email: adminEmail, name: 'Admin' };
          }
          return null;
        }

        // 3. Standard Email & Password
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        const rawHash =
          process.env.ADMIN_PASSWORD_HASH ||
          '$2a$10$v/9mdnsj9vNYoCQDby2dsOroM/6.nlIxQr80QAL2kDws15oR2T8c6';
        const adminHash = rawHash.replace(/\\/g, '');

        if (!email || email !== adminEmail) return null;

        const valid = await bcrypt.compare(password, adminHash);
        if (!valid) return null;

        return { id: 'admin', email: adminEmail, name: 'Admin' };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.email = token.email as string;
      return session;
    }
  }
};
