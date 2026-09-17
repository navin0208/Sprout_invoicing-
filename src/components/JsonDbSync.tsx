'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'sprout_invoicing_json_db';

export function JsonDbSync() {
  const router = useRouter();
  const syncingRef = useRef(false);

  useEffect(() => {
    async function syncDatabase() {
      if (syncingRef.current) return;
      syncingRef.current = true;

      try {
        const res = await fetch('/api/db/sync', { cache: 'no-store' });
        if (!res.ok) return;
        const serverDb = await res.json();

        const localRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        let localDb: any = null;
        if (localRaw) {
          try {
            localDb = JSON.parse(localRaw);
          } catch {
            // ignore
          }
        }

        const serverRecordsCount =
          (serverDb.invoices?.length || 0) +
          (serverDb.clients?.length || 0) +
          (serverDb.quotations?.length || 0);

        const localRecordsCount =
          (localDb?.invoices?.length || 0) +
          (localDb?.clients?.length || 0) +
          (localDb?.quotations?.length || 0);

        // If the server was recycled/blank but the browser has saved data, restore the server!
        if (serverRecordsCount === 0 && localRecordsCount > 0) {
          await fetch('/api/db/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb)
          });
          router.refresh();
        } else if (serverRecordsCount > 0 || !localDb) {
          // Keep localStorage up-to-date with server's latest data
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverDb));
        }
      } catch (err) {
        // Silent catch: network offline or background
      } finally {
        syncingRef.current = false;
      }
    }

    syncDatabase();

    // Re-sync on tab focus / visibility change
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncDatabase();
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    return () => window.removeEventListener('visibilitychange', onVisibilityChange);
  }, [router]);

  return null;
}
