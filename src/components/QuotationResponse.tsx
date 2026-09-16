'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function QuotationResponse({ publicId, status }: { publicId: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState<'ACCEPTED' | 'REJECTED' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!['SENT', 'VIEWED'].includes(status)) return null;

  async function submit(decision: 'ACCEPTED' | 'REJECTED') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotations/${publicId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to submit response');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
      setShowNote(null);
    }
  }

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      {showNote ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {showNote === 'ACCEPTED' ? 'Great! Add an optional note, then confirm.' : 'Sorry to hear that. Add an optional note, then confirm.'}
          </p>
          <textarea className="input" rows={2} placeholder="Optional note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowNote(null)} disabled={busy}>
              Back
            </button>
            <button
              className={showNote === 'ACCEPTED' ? 'btn-gold' : 'btn-danger'}
              onClick={() => submit(showNote)}
              disabled={busy}
            >
              {busy ? 'Submitting…' : `Confirm ${showNote === 'ACCEPTED' ? 'acceptance' : 'decline'}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button className="btn-gold" onClick={() => setShowNote('ACCEPTED')}>
            ✓ Accept quotation
          </button>
          <button className="btn-danger" onClick={() => setShowNote('REJECTED')}>
            ✕ Decline
          </button>
        </div>
      )}
      {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
    </div>
  );
}
