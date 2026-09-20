'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { StatusBadge } from '@/components/StatusBadge';
import { ItemDescription } from '@/components/ItemDescription';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Timeline, TimelineStep } from '@/components/Timeline';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/money';

type QuotationDetail = {
  id: string;
  number: string;
  status: string;
  publicId: string;
  currency: string;
  issueDate: string;
  expiryDate: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  clientNote: string | null;
  client?: { id: string; name: string; email: string | null; phone: string | null } | null;
  items?: {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    rateCents: number;
    taxPercent: number;
    lineTotalCents: number;
  }[];
  invoices?: {
    id: string;
    number: string;
    status: string;
    totalCents: number;
    currency: string;
    issueDate: string;
  }[];
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setQuotation(await apiFetch<QuotationDetail>(`/api/quotations/${id}`));
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
    if (!quotation) return;
    navigator.clipboard.writeText(`${window.location.origin}/p/quotation/${quotation.publicId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Client link copied to clipboard.');
  }

  if (!quotation) {
    return (
      <>
        <Topbar title="Quotation" />
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

  const isDraft = quotation.status === 'DRAFT';
  const accepted = quotation.status === 'ACCEPTED';
  const rejected = quotation.status === 'REJECTED';
  const invoices = quotation.invoices || [];
  const converted = quotation.status === 'CONVERTED' || invoices.length > 0;
  const invoiceCount = invoices.length;
  // A retainer quote gets invoiced every month, so this stays available
  // after the first conversion — each run creates a fresh editable draft.
  const convertLabel = invoiceCount === 0 ? 'Convert to invoice' : 'Create next invoice';

  const convert = () =>
    run('convert', async () => {
      const inv = await apiFetch<any>(`/api/quotations/${id}/convert`, { method: 'POST', body: JSON.stringify({}) });
      router.push(`/invoices/${inv.id}`);
    });

  const steps: TimelineStep[] = [
    { label: 'Created', date: quotation.createdAt, done: true, icon: 'edit' },
    { label: 'Sent', date: quotation.sentAt, done: !isDraft, current: quotation.status === 'SENT', icon: 'send' },
    {
      label: 'Viewed',
      date: quotation.viewedAt,
      done: Boolean(quotation.viewedAt),
      current: quotation.status === 'VIEWED',
      icon: 'eye'
    },
    {
      label: rejected ? 'Declined' : 'Accepted',
      date: quotation.respondedAt,
      done: accepted || rejected || converted,
      current: accepted || rejected,
      tone: rejected ? 'bad' : 'good',
      icon: rejected ? 'x' : 'check'
    },
    {
      label: 'Invoiced',
      date: null,
      done: converted,
      current: converted,
      tone: 'good',
      icon: 'invoice'
    }
  ];

  return (
    <>
      <Topbar
        title={quotation.number || 'Quotation'}
        subtitle={quotation.client?.name || ''}
        actions={
          isDraft ? (
            <button
              className="btn-primary"
              disabled={busy === 'send'}
              onClick={() =>
                run('send', () => apiFetch(`/api/quotations/${id}/send`, { method: 'POST' }), 'Quotation emailed to the client.')
              }
            >
              <Icon name="send" className="w-4 h-4" />
              {busy === 'send' ? 'Sending…' : 'Send to client'}
            </button>
          ) : (
            <button className="btn-primary" disabled={busy === 'convert'} onClick={convert}>
              <Icon name="invoice" className="w-4 h-4" />
              {busy === 'convert' ? 'Creating…' : convertLabel}
            </button>
          )
        }
      />

      <main className="p-6 max-w-[1200px] space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <StatusBadge status={quotation.status} />
              <span className="text-xs text-gray-500">
                Issued {formatDate(quotation.issueDate)}
                {quotation.expiryDate ? ` · Valid till ${formatDate(quotation.expiryDate)}` : ''}
              </span>
            </div>
          </div>
          <Timeline steps={steps} />
        </section>

        {invoiceCount > 0 ? (
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="section-title">Invoices raised from this quotation</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {invoiceCount} so far · billed{' '}
                  {formatMoney(
                    invoices.filter((i) => i.status !== 'CANCELLED').reduce((s, i) => s + (i.totalCents || 0), 0),
                    quotation.currency
                  )}{' '}
                  in total
                </p>
              </div>
              <button className="btn-secondary btn-sm" disabled={busy === 'convert'} onClick={convert}>
                <Icon name="plus" className="w-3.5 h-3.5" />
                {busy === 'convert' ? 'Creating…' : 'New invoice from this quote'}
              </button>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="row-link" onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <td className="td font-medium text-brand-800">{inv.number}</td>
                    <td className="td text-xs text-gray-500 hidden sm:table-cell">{formatDate(inv.issueDate)}</td>
                    <td className="td text-right font-semibold tnum whitespace-nowrap">
                      {formatMoney(inv.totalCents, inv.currency)}
                    </td>
                    <td className="td text-right">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {quotation.clientNote ? (
          <div className="card p-4 flex gap-3">
            <Avatar name={quotation.client?.name || 'Client'} size="sm" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{quotation.client?.name || 'Client'} left a note when responding</p>
              <p className="text-sm text-brand-800">“{quotation.clientNote}”</p>
            </div>
          </div>
        ) : null}

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
                  {(quotation.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="td">
                        <ItemDescription description={item.description} />
                      </td>
                      <td className="td text-right whitespace-nowrap text-gray-500">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="td text-right tnum whitespace-nowrap">{formatMoney(item.rateCents, quotation.currency)}</td>
                      <td className="td text-right text-gray-500 tnum">{item.taxPercent}%</td>
                      <td className="td text-right font-semibold tnum whitespace-nowrap">
                        {formatMoney(item.lineTotalCents, quotation.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end bg-gray-50/40">
                <dl className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Subtotal</dt>
                    <dd className="tnum">{formatMoney(quotation.subtotalCents, quotation.currency)}</dd>
                  </div>
                  {quotation.discountCents > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Discount</dt>
                      <dd className="tnum">-{formatMoney(quotation.discountCents, quotation.currency)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Tax</dt>
                    <dd className="tnum">{formatMoney(quotation.taxCents, quotation.currency)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-brand-800 border-t border-gray-200 pt-2">
                    <dt>Total</dt>
                    <dd className="tnum">{formatMoney(quotation.totalCents, quotation.currency)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            {(quotation.notes || quotation.terms) && (
              <section className="card p-5 space-y-4 text-sm">
                {quotation.notes ? (
                  <div>
                    <p className="label">Notes</p>
                    <p className="whitespace-pre-line text-brand-700">{quotation.notes}</p>
                  </div>
                ) : null}
                {quotation.terms ? (
                  <div>
                    <p className="label">Terms</p>
                    <p className="whitespace-pre-line text-brand-700">{quotation.terms}</p>
                  </div>
                ) : null}
              </section>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20">
            <section className="card p-5">
              <p className="text-xs font-medium text-gray-500">Quoted total</p>
              <p className="text-3xl font-semibold text-brand-800 mt-1 tnum">
                {formatMoney(quotation.totalCents, quotation.currency)}
              </p>

              <div className="mt-5 space-y-2">
                {isDraft ? (
                  <>
                    <button
                      className="btn-primary w-full"
                      disabled={busy === 'send'}
                      onClick={() =>
                        run('send', () => apiFetch(`/api/quotations/${id}/send`, { method: 'POST' }), 'Quotation emailed to the client.')
                      }
                    >
                      <Icon name="send" className="w-4 h-4" />
                      {busy === 'send' ? 'Sending…' : 'Send to client'}
                    </button>
                    <Link href={`/quotations/${id}/edit`} className="btn-secondary w-full">
                      <Icon name="edit" className="w-4 h-4" />
                      Edit quotation
                    </Link>
                  </>
                ) : null}

                {!isDraft ? (
                  <button className="btn-gold w-full" disabled={busy === 'convert'} onClick={convert}>
                    <Icon name="invoice" className="w-4 h-4" />
                    {busy === 'convert' ? 'Creating…' : convertLabel}
                  </button>
                ) : null}
                {!isDraft ? (
                  <p className="text-[11px] text-gray-400 text-center pt-0.5">
                    Creates an editable draft — adjust it to the month&apos;s work before sending.
                  </p>
                ) : null}

                {['SENT', 'VIEWED'].includes(quotation.status) ? (
                  <button
                    className="btn-secondary w-full"
                    disabled={busy === 'resend'}
                    onClick={() =>
                      run('resend', () => apiFetch(`/api/quotations/${id}/send`, { method: 'POST' }), 'Quotation re-sent.')
                    }
                  >
                    <Icon name="mail" className="w-4 h-4" />
                    {busy === 'resend' ? 'Sending…' : 'Send again'}
                  </button>
                ) : null}

                <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary w-full">
                  <Icon name="download" className="w-4 h-4" />
                  Download PDF
                </a>
              </div>
            </section>

            {!isDraft ? (
              <section className="card p-5">
                <p className="label">Client link</p>
                <p className="text-xs text-gray-500 mb-3">The client can accept or decline straight from this page.</p>
                <button
                  onClick={copyLink}
                  className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs text-gray-600 hover:border-gold-400 hover:bg-gold-50 transition-colors group"
                >
                  <Icon name="link" className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-gold-600" />
                  <span className="truncate flex-1">/p/quotation/{quotation.publicId}</span>
                  <span className="shrink-0 font-medium text-brand-700">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </section>
            ) : null}

            <section className="card p-5">
              <p className="label">Client</p>
              {quotation.client ? (
                <Link href={`/clients/${quotation.client.id}`} className="flex items-center gap-3 group">
                  <Avatar name={quotation.client.name || 'Client'} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-800 truncate group-hover:text-gold-700 transition-colors">
                      {quotation.client.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {quotation.client.email || quotation.client.phone || 'No contact'}
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-gray-400">No client details</p>
              )}
            </section>

            {isDraft ? (
              <button
                className="btn-ghost w-full text-xs hover:text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (!confirm('Delete this draft quotation?')) return;
                  try {
                    await apiFetch(`/api/quotations/${id}`, { method: 'DELETE' });
                    toast.success('Draft deleted.');
                    router.push('/quotations');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not delete.');
                  }
                }}
              >
                Delete this draft
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
