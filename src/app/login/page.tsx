'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('That email and password combination didn’t work.');
      return;
    }
    router.push(params.get('callbackUrl') || '/dashboard');
  }

  return (
    <div className="w-full max-w-sm">
      <div className="card p-8 shadow-lift animate-slide-up">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEFAULT_LOGO_PATH} alt="The Sprout Media" className="w-36 h-auto object-contain mb-6" />
        <h1 className="text-xl font-semibold text-brand-800">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Sign in to manage invoices and quotations.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@thesproutmedia.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          ) : null}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <p className="text-center text-xs text-gray-400 mt-5">Invoicing &amp; quotations · The Sprout Media</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* soft brand wash behind the card */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gold-200/40 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-200/30 blur-3xl" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
