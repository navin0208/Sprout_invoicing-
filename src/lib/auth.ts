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
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
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
