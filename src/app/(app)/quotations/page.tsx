'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/money';

type Quotation = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  currency: string;
  expiryDate: string | null;
  client: { name: string };
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Declined' },
  { value: 'CONVERTED', label: 'Converted' }
];

export default function QuotationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const timer = setTimeout(
      () => {
        apiFetch<Quotation[]>(`/api/quotations?${params.toString()}`).then((data) => {
          setQuotations(data);
          setLoading(false);
        });
      },
      q ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [status, q]);

  const openValue = quotations
    .filter((x) => ['SENT', 'VIEWED'].includes(x.status))
    .reduce((s, x) => s + x.totalCents, 0);

  return (
    <>
      <Topbar
        title="Quotations"
        subtitle={loading ? undefined : `${quotations.length} shown · ${formatMoney(openValue)} awaiting a reply`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/api/export/excel?type=quotations"
              download
              className="btn-secondary"
              title="Export all quotations to Excel"
            >
              <Icon name="fileSpreadsheet" className="w-4 h-4 text-emerald-600" />
              Export Excel
            </a>
            <Link href="/quotations/new" className="btn-primary">
              <Icon name="plus" className="w-4 h-4" />
              New quotation
            </Link>
          </div>
        }
      />

      <main className="p-6 max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Icon name="search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search quote no. or client…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  status === f.value
                    ? 'bg-brand-800 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-brand-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="th">Client</th>
                <th className="th hidden sm:table-cell">Valid until</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableSkeleton rows={5} cols={4} />
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title={q || status ? 'No quotations match that' : 'No quotations yet'}
                      description={
                        q || status
                          ? 'Try a different search or clear the filter.'
                          : 'Send a quotation — clients can accept it in one click from the link you share.'
                      }
                      actionLabel={q || status ? undefined : 'Create quotation'}
                      actionHref={q || status ? undefined : '/quotations/new'}
                    />
                  </td>
                </tr>
              ) : (
                quotations.map((quote) => (
                  <tr key={quote.id} className="row-link" onClick={() => router.push(`/quotations/${quote.id}`)}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={quote.client.name} />
                        <div className="min-w-0">
                          <Link
                            href={`/quotations/${quote.id}`}
                            className="block font-medium text-brand-800 hover:text-gold-700 truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {quote.client.name}
                          </Link>
                          <span className="block text-xs text-gray-500">{quote.number}</span>
                        </div>
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                      {quote.expiryDate ? formatDate(quote.expiryDate) : '—'}
                    </td>
                    <td className="td text-right font-semibold text-brand-800 tnum whitespace-nowrap">
                      {formatMoney(quote.totalCents, quote.currency)}
                    </td>
                    <td className="td text-right">
                      <StatusBadge status={quote.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
