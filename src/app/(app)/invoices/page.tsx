'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/money';

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  dueDate: string;
  client: { name: string };
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PARTIALLY_PAID', label: 'Part paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' }
];

function InvoicesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [q, setQ] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const timer = setTimeout(() => {
      apiFetch<Invoice[]>(`/api/invoices?${params.toString()}`).then((data) => {
        setInvoices(data);
        setLoading(false);
      });
    }, q ? 250 : 0); // debounce typing, but filter clicks feel instant
    return () => clearTimeout(timer);
  }, [status, q]);

  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceDueCents, 0);

  return (
    <>
      <Topbar
        title="Invoices"
        subtitle={loading ? undefined : `${invoices.length} shown · ${formatMoney(totalOutstanding)} outstanding`}
        actions={
          <Link href="/invoices/new" className="btn-primary">
            <Icon name="plus" className="w-4 h-4" />
            New invoice
          </Link>
        }
      />

      <main className="p-6 max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Icon name="search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search invoice no. or client…"
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
                <th className="th hidden md:table-cell">Payment</th>
                <th className="th hidden sm:table-cell">Due</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title={q || status ? 'No invoices match that' : 'No invoices yet'}
                      description={
                        q || status
                          ? 'Try a different search or clear the filter.'
                          : 'Create your first invoice — it takes about a minute.'
                      }
                      actionLabel={q || status ? undefined : 'Create invoice'}
                      actionHref={q || status ? undefined : '/invoices/new'}
                    />
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const paidPct =
                    inv.totalCents > 0 ? Math.min(100, Math.round((inv.amountPaidCents / inv.totalCents) * 100)) : 0;
                  return (
                    <tr key={inv.id} className="row-link" onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={inv.client.name} />
                          <div className="min-w-0">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="block font-medium text-brand-800 hover:text-gold-700 truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inv.client.name}
                            </Link>
                            <span className="block text-xs text-gray-500">{inv.number}</span>
                          </div>
                        </div>
                      </td>
                      <td className="td hidden md:table-cell w-44">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${paidPct === 100 ? 'bg-sprout-500' : 'bg-gold-500'}`}
                              style={{ width: `${paidPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400 tnum w-8 text-right">{paidPct}%</span>
                        </div>
                      </td>
                      <td className="td hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="td text-right whitespace-nowrap">
                        <span className="font-semibold text-brand-800 tnum">{formatMoney(inv.totalCents, inv.currency)}</span>
                        {inv.balanceDueCents > 0 && inv.balanceDueCents !== inv.totalCents ? (
                          <span className="block text-[11px] text-gray-400 tnum">
                            {formatMoney(inv.balanceDueCents, inv.currency)} due
                          </span>
                        ) : null}
                      </td>
                      <td className="td text-right">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesInner />
    </Suspense>
  );
}
