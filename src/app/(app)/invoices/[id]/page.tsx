'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { ItemDescription } from '@/components/ItemDescription';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Timeline, TimelineStep } from '@/components/Timeline';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/money';

type InvoiceDetail = {
  id: string;
  number: string;
  status: string;
  publicId: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  client: { id: string; name: string; email: string | null; phone: string | null };
  items: {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    rateCents: number;
    taxPercent: number;
    lineTotalCents: number;
  }[];
  payments: { id: string; amountCents: number; date: string; method: string; note: string | null }[];
  reminders: { id: string; type: string; daysOffset: number; sentAt: string; success: boolean; error: string | null }[];
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    method: 'Bank Transfer',
    note: ''
  });
  const [copied, setCopied] = useState(false);

  async function load() {
    setInvoice(await apiFetch<InvoiceDetail>(`/api/invoices/${id}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(action: string, fn: () => Promise<any>, successMessage?: string) {
    setBusy(action);
    try {
      await fn();
      await load();
      if (successMessage) toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(null);
    }
  }

  function copyLink() {
    if (!invoice) return;
    navigator.clipboard.writeText(`${window.location.origin}/p/invoice/${invoice.publicId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Client link copied to clipboard.');
  }

  if (!invoice) {
    return (
      <>
        <Topbar title="Invoice" />
        <main className="p-6 max-w-[1200px] space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 lg:col-span-2 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </main>
      </>
    );
  }

  const paidPct = invoice.totalCents > 0 ? Math.min(100, Math.round((invoice.amountPaidCents / invoice.totalCents) * 100)) : 0;
  const isDraft = invoice.status === 'DRAFT';
  const isCancelled = invoice.status === 'CANCELLED';
  const isPaid = invoice.status === 'PAID';
  const isLive = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status);
  // Editable right up until a payment lands — a monthly invoice often needs
  // adjusting to match what was actually delivered, sometimes after sending.
  const canEdit = !isCancelled && invoice.payments.length === 0;

  const steps: TimelineStep[] = isCancelled
    ? [
        { label: 'Created', date: invoice.createdAt, done: true, icon: 'edit' },
        { label: 'Cancelled', date: invoice.cancelledAt, done: true, current: true, tone: 'bad', icon: 'x' }
      ]
    : [
        { label: 'Created', date: invoice.createdAt, done: true, icon: 'edit' },
        { label: 'Sent', date: invoice.sentAt, done: !isDraft, current: invoice.status === 'SENT', icon: 'send' },
        {
          label: 'Viewed',
          date: invoice.viewedAt,
          done: Boolean(invoice.viewedAt),
          current: invoice.status === 'VIEWED',
          icon: 'eye'
        },
        {
          label: isPaid ? 'Paid' : 'Payment',
          date: invoice.paidAt,
          done: isPaid || invoice.amountPaidCents > 0,
          current: invoice.status === 'PARTIALLY_PAID' || isPaid,
          tone: isPaid ? 'good' : invoice.status === 'OVERDUE' ? 'bad' : 'default',
          icon: 'wallet'
        }
      ];

  return (
    <>
      <Topbar
        title={invoice.number}
        subtitle={invoice.client.name}
        actions={
          isDraft ? (
            <button className="btn-primary" disabled={busy === 'send'} onClick={() => run('send', () => apiFetch(`/api/invoices/${id}/send`, { method: 'POST' }), 'Invoice emailed to the client.')}>
              <Icon name="send" className="w-4 h-4" />
              {busy === 'send' ? 'Sending…' : 'Send to client'}
            </button>
          ) : isLive ? (
            <button className="btn-primary" onClick={() => setShowPayment(true)}>
              <Icon name="wallet" className="w-4 h-4" />
              Record payment
            </button>
          ) : null
        }
      />

      <main className="p-6 max-w-[1200px] space-y-6">
        {/* Where this invoice is in its life */}
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <span className="text-xs text-gray-500">
                Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
              </span>
            </div>
            {invoice.lastReminderAt ? (
              <span className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                <Icon name="bell" className="w-3.5 h-3.5" />
                {invoice.reminderCount} reminder{invoice.reminderCount === 1 ? '' : 's'} sent · last{' '}
                {formatDate(invoice.lastReminderAt)}
              </span>
            ) : null}
          </div>
          <Timeline steps={steps} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <section className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50/70">
                  <tr>
                    <th className="th">Item</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Rate</th>
                    <th className="th text-right">Tax</th>
                    <th className="th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="td">
                        <ItemDescription description={item.description} />
                      </td>
                      <td className="td text-right whitespace-nowrap text-gray-500">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="td text-right tnum whitespace-nowrap">{formatMoney(item.rateCents, invoice.currency)}</td>
                      <td className="td text-right text-gray-500 tnum">{item.taxPercent}%</td>
                      <td className="td text-right font-semibold tnum whitespace-nowrap">
                        {formatMoney(item.lineTotalCents, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end bg-gray-50/40">
                <dl className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Subtotal</dt>
                    <dd className="tnum">{formatMoney(invoice.subtotalCents, invoice.currency)}</dd>
                  </div>
                  {invoice.discountCents > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Discount</dt>
                      <dd className="tnum">-{formatMoney(invoice.discountCents, invoice.currency)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Tax</dt>
                    <dd className="tnum">{formatMoney(invoice.taxCents, invoice.currency)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-brand-800 border-t border-gray-200 pt-2">
                    <dt>Total</dt>
                    <dd className="tnum">{formatMoney(invoice.totalCents, invoice.currency)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="section-title">Payments</h2>
                {isLive ? (
                  <button className="btn-ghost btn-sm" onClick={() => setShowPayment(true)}>
                    <Icon name="plus" className="w-3.5 h-3.5" />
                    Add
                  </button>
                ) : null}
              </div>
              {invoice.payments.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-400 text-center">
                  No payments recorded yet{isLive ? ' — add one when the money lands.' : '.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="group flex items-center gap-3 px-5 py-3">
                      <span className="w-8 h-8 rounded-lg bg-sprout-50 text-sprout-600 flex items-center justify-center shrink-0">
                        <Icon name="check" className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-brand-800 tnum">{formatMoney(p.amountCents, invoice.currency)}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(p.date)} · {p.method}
                          {p.note ? ` · ${p.note}` : ''}
                        </p>
                      </div>
                      <button
                        className="btn-ghost btn-sm opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-opacity"
                        onClick={() => {
                          if (!confirm('Remove this payment?')) return;
                          run('payment-delete', () => apiFetch(`/api/invoices/${id}/payments/${p.id}`, { method: 'DELETE' }), 'Payment removed.');
                        }}
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {invoice.reminders.length > 0 ? (
              <section className="card">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="section-title">Reminder activity</h2>
                </div>
                <ul className="divide-y divide-gray-100">
                  {invoice.reminders.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <Icon
                        name={r.success ? 'mail' : 'alert'}
                        className={`w-4 h-4 shrink-0 ${r.success ? 'text-gray-400' : 'text-red-500'}`}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-brand-700 capitalize">{r.type.replace('_', ' ').toLowerCase()} reminder</span>
                        {!r.success ? <span className="block text-xs text-red-600 truncate">Failed: {r.error}</span> : null}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(r.sentAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {(invoice.notes || invoice.terms) && (
              <section className="card p-5 space-y-4 text-sm">
                {invoice.notes ? (
                  <div>
                    <p className="label">Notes</p>
                    <p className="whitespace-pre-line text-brand-700">{invoice.notes}</p>
                  </div>
                ) : null}
                {invoice.terms ? (
                  <div>
                    <p className="label">Terms</p>
                    <p className="whitespace-pre-line text-brand-700">{invoice.terms}</p>
                  </div>
                ) : null}
              </section>
            )}
          </div>

          {/* Sticky money + actions rail */}
          <div className="space-y-4 lg:sticky lg:top-20">
            <section className="card p-5">
              <p className="text-xs font-medium text-gray-500">{isPaid ? 'Paid in full' : 'Balance due'}</p>
              <p className={`text-3xl font-semibold mt-1 tnum ${isPaid ? 'text-sprout-600' : 'text-brand-800'}`}>
                {formatMoney(isPaid ? invoice.totalCents : invoice.balanceDueCents, invoice.currency)}
              </p>

              <div className="mt-4">
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${paidPct === 100 ? 'bg-sprout-500' : 'bg-gold-500'}`}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 mt-1.5 tnum">
                  <span>{formatMoney(invoice.amountPaidCents, invoice.currency)} paid</span>
                  <span>{paidPct}%</span>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {isDraft ? (
                  <button
                    className="btn-primary w-full"
                    disabled={busy === 'send'}
                    onClick={() =>
                      run('send', () => apiFetch(`/api/invoices/${id}/send`, { method: 'POST' }), 'Invoice emailed to the client.')
                    }
                  >
                    <Icon name="send" className="w-4 h-4" />
                    {busy === 'send' ? 'Sending…' : 'Send to client'}
                  </button>
                ) : null}

                {canEdit ? (
                  <Link href={`/invoices/${id}/edit`} className="btn-secondary w-full">
                    <Icon name="edit" className="w-4 h-4" />
                    Edit invoice
                  </Link>
                ) : null}

                {isLive ? (
                  <>
                    <button className="btn-gold w-full" onClick={() => setShowPayment(true)}>
                      <Icon name="wallet" className="w-4 h-4" />
                      Record payment
                    </button>
                    <button
                      className="btn-secondary w-full"
                      disabled={busy === 'reminder'}
                      onClick={() =>
                        run(
                          'reminder',
                          () => apiFetch(`/api/invoices/${id}/send-reminder`, { method: 'POST' }),
                          'Reminder sent to the client.'
                        )
                      }
                    >
                      <Icon name="bell" className="w-4 h-4" />
                      {busy === 'reminder' ? 'Sending…' : 'Send reminder now'}
                    </button>
                  </>
                ) : null}

                <a
                  href={`/api/invoices/${id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full"
                >
                  <Icon name="download" className="w-4 h-4" />
                  Download PDF
                </a>
              </div>
            </section>

            {!isDraft ? (
              <section className="card p-5">
                <p className="label">Client link</p>
                <p className="text-xs text-gray-500 mb-3">Anyone with this link can view and download the invoice.</p>
                <button
                  onClick={copyLink}
                  className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs text-gray-600 hover:border-gold-400 hover:bg-gold-50 transition-colors group"
                >
                  <Icon name="link" className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-gold-600" />
                  <span className="truncate flex-1">/p/invoice/{invoice.publicId}</span>
                  <span className="shrink-0 font-medium text-brand-700">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </section>
            ) : null}

            <section className="card p-5">
              <p className="label">Client</p>
              <Link href={`/clients/${invoice.client.id}`} className="flex items-center gap-3 group">
                <Avatar name={invoice.client.name} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-800 truncate group-hover:text-gold-700 transition-colors">
                    {invoice.client.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{invoice.client.email || invoice.client.phone || 'No contact'}</p>
                </div>
              </Link>
              {!invoice.client.email ? (
                <p className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">
                  <Icon name="alert" className="w-3.5 h-3.5 shrink-0 mt-px" />
                  No email on file — reminders can&apos;t be sent to this client.
                </p>
              ) : null}
            </section>

            {!isPaid && !isCancelled ? (
              <button
                className="btn-ghost w-full text-xs hover:text-red-600 hover:bg-red-50"
                disabled={busy === 'cancel'}
                onClick={() => {
                  if (!confirm('Cancel this invoice? It stays on record but is no longer payable.')) return;
                  run('cancel', () => apiFetch(`/api/invoices/${id}/cancel`, { method: 'POST' }), 'Invoice cancelled.');
                }}
              >
                Cancel this invoice
              </button>
            ) : null}
          </div>
        </div>
      </main>

      {showPayment && (
        <Modal
          title="Record payment"
          description={`${formatMoney(invoice.balanceDueCents, invoice.currency)} outstanding on ${invoice.number}`}
          onClose={() => setShowPayment(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await run(
                'payment-add',
                () =>
                  apiFetch(`/api/invoices/${id}/payments`, {
                    method: 'POST',
                    body: JSON.stringify({
                      amount: Number(payment.amount),
                      date: payment.date,
                      method: payment.method,
                      note: payment.note
                    })
                  }),
                'Payment recorded.'
              );
              setShowPayment(false);
              setPayment({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', note: '' });
            }}
            className="space-y-3"
          >
            <div>
              <label className="label">Amount *</label>
              <input
                className="input tnum"
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                placeholder="0.00"
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              />
              <button
                type="button"
                className="text-[11px] text-brand-600 hover:text-gold-700 mt-1.5"
                onClick={() => setPayment({ ...payment, amount: String(invoice.balanceDueCents / 100) })}
              >
                Use full balance ({formatMoney(invoice.balanceDueCents, invoice.currency)})
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={payment.date}
                  onChange={(e) => setPayment({ ...payment, date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Method</label>
                <select
                  className="input"
                  value={payment.method}
                  onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                >
                  {['Bank Transfer', 'UPI', 'Cash', 'Card', 'Other'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Note</label>
              <input
                className="input"
                placeholder="Reference no., cheque no.…"
                value={payment.note}
                onChange={(e) => setPayment({ ...payment, note: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowPayment(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy === 'payment-add'}>
                {busy === 'payment-add' ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
