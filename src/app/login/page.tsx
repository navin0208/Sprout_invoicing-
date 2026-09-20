'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';
import { Icon } from '@/components/Icon';

type ColorKey = 'R' | 'G' | 'B' | 'Y';

const COLORS: { key: ColorKey; label: string; bg: string; ring: string; text: string; glow: string }[] = [
  {
    key: 'R',
    label: 'Red',
    bg: 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700',
    ring: 'border-rose-400',
    text: 'text-white',
    glow: 'shadow-rose-500/30'
  },
  {
    key: 'G',
    label: 'Green',
    bg: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700',
    ring: 'border-emerald-400',
    text: 'text-white',
    glow: 'shadow-emerald-500/30'
  },
  {
    key: 'B',
    label: 'Blue',
    bg: 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700',
    ring: 'border-sky-400',
    text: 'text-white',
    glow: 'shadow-sky-500/30'
  },
  {
    key: 'Y',
    label: 'Yellow',
    bg: 'bg-amber-400 hover:bg-amber-500 active:bg-amber-600',
    ring: 'border-amber-300',
    text: 'text-amber-950',
    glow: 'shadow-amber-400/30'
  }
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'pattern' | 'password'>('pattern');

  // Pattern lock state
  const [pattern, setPattern] = useState<ColorKey[]>([]);
  const [shake, setShake] = useState(false);

  // Email/Password state (prefilled with default dev credentials)
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('changeme123');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFastUnlock() {
    setLoading(true);
    setError(null);
    try {
      const res = await signIn('credentials', { quickUnlock: 'true', redirect: false });
      setLoading(false);
      if (res?.error) {
        setError('Could not unlock. Please try again.');
        return;
      }
      const targetUrl = params.get('callbackUrl') || '/dashboard';
      window.location.href = targetUrl;
    } catch {
      setLoading(false);
      setError('Unlock failed. Please refresh the page.');
    }
  }

  async function handleColorTap(colorKey: ColorKey) {
    if (loading) return;
    if (pattern.length >= 4) return;

    const nextPattern = [...pattern, colorKey];
    setPattern(nextPattern);
    setError(null);

    // Auto-submit on 4 taps
    if (nextPattern.length === 4) {
      setLoading(true);
      const code = nextPattern.join('-');
      try {
        const res = await signIn('credentials', { patternCode: code, redirect: false });
        setLoading(false);
        if (res?.error) {
          setShake(true);
          setError('Incorrect pattern. Tip: Tap 🟢 Green 4 times, or 🔴 🟢 🔵 🟡');
          setTimeout(() => {
            setPattern([]);
            setShake(false);
          }, 800);
          return;
        }
        const targetUrl = params.get('callbackUrl') || '/dashboard';
        window.location.href = targetUrl;
      } catch {
        setLoading(false);
        setError('Login error. Please try again.');
      }
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      setLoading(false);
      if (res?.error) {
        setError('Invalid email or password.');
        return;
      }
      const targetUrl = params.get('callbackUrl') || '/dashboard';
      window.location.href = targetUrl;
    } catch {
      setLoading(false);
      setError('Authentication error. Please try again.');
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="card p-7 shadow-lift animate-slide-up bg-white/95 backdrop-blur-md border border-gray-100/80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEFAULT_LOGO_PATH} alt="The Sprout Media" className="w-32 h-auto object-contain mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-brand-900">
              {mode === 'pattern' ? 'Quick Unlock' : 'Admin Login'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === 'pattern' ? 'Instant access for organization use' : 'Sign in with admin credentials'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'pattern' ? 'password' : 'pattern');
              setError(null);
            }}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded bg-brand-50 hover:bg-brand-100 transition-colors"
          >
            {mode === 'pattern' ? 'Use Password' : 'Use Pattern'}
          </button>
        </div>

        {error ? (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-start gap-2 animate-shake">
            <Icon name="alert" className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {mode === 'pattern' ? (
          <div className="space-y-4">
            {/* 1-Click Fast Unlock Button */}
            <button
              type="button"
              onClick={handleFastUnlock}
              disabled={loading}
              className="btn-gold w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Icon name="checkCircle" className="w-4 h-4" />
              {loading ? 'Unlocking…' : '⚡ 1-Click Fast Unlock'}
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-gray-200 w-full" />
              <span className="bg-white px-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider absolute">
                or tap 4-color pattern
              </span>
            </div>

            {/* Pattern Dots Display */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div
                className={`flex items-center gap-3 p-2 rounded-xl bg-gray-50/80 border border-gray-100 transition-all ${
                  shake ? 'animate-shake border-red-300' : ''
                }`}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const val = pattern[idx];
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        val === 'R'
                          ? 'bg-rose-500 border-rose-600 scale-110 shadow-sm shadow-rose-400'
                          : val === 'G'
                          ? 'bg-emerald-500 border-emerald-600 scale-110 shadow-sm shadow-emerald-400'
                          : val === 'B'
                          ? 'bg-sky-500 border-sky-600 scale-110 shadow-sm shadow-sky-400'
                          : val === 'Y'
                          ? 'bg-amber-400 border-amber-500 scale-110 shadow-sm shadow-amber-300'
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  );
                })}
              </div>

              {pattern.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPattern([])}
                  className="text-[11px] text-gray-400 hover:text-gray-600 mt-2 flex items-center gap-1"
                >
                  <Icon name="x" className="w-3 h-3" /> Clear sequence
                </button>
              ) : (
                <p className="text-[11px] text-gray-400 mt-2">
                  Default pattern: 🟢 🟢 🟢 🟢 or 🔴 🟢 🔵 🟡
                </p>
              )}
            </div>

            {/* Tactile Color Pad (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleColorTap(c.key)}
                  disabled={loading}
                  className={`${c.bg} ${c.text} h-16 rounded-xl font-bold text-sm tracking-wide shadow-md ${c.glow} active:scale-95 transition-all duration-100 flex flex-col items-center justify-center gap-1`}
                >
                  <span className="w-3 h-3 rounded-full bg-white/40 border border-white/60" />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Standard Email & Password Form */
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input text-sm"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input text-sm"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 font-bold" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleFastUnlock}
                disabled={loading}
                className="btn-gold w-full py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Icon name="checkCircle" className="w-3.5 h-3.5" />
                ⚡ 1-Click Fast Unlock
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-5">Invoicing &amp; quotations · The Sprout Media</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-brand-50/30">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gold-200/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-emerald-200/25 blur-3xl pointer-events-none" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
