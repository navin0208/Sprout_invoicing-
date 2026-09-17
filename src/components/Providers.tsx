'use client';

import { SessionProvider } from 'next-auth/react';
import { JsonDbSync } from './JsonDbSync';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <JsonDbSync />
      {children}
    </SessionProvider>
  );
}

