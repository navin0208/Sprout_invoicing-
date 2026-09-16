'use client';

import { signOut, useSession } from 'next-auth/react';
import { Icon } from './Icon';

export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const { data } = useSession();
  const email = data?.user?.email ?? '';

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-[#faf9f7]/85 backdrop-blur-md">
      <div className="h-16 flex items-center justify-between px-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-brand-800 truncate">{title}</h1>
          {subtitle ? <p className="text-xs text-gray-500 truncate">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
            <span className="w-7 h-7 rounded-full bg-brand-800 text-gold-400 text-[11px] font-bold flex items-center justify-center">
              {email.slice(0, 1).toUpperCase() || 'A'}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="btn-ghost btn-sm"
              title={`Sign out (${email})`}
            >
              <Icon name="logout" className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
