'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/money';

type Doc = { id: string; number: string; status: string; totalCents: number; balanceDueCents?: number; currency: string; dueDate?: string; createdAt: string };

type ClientDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  gstin: string | null;
  notes: string | null;
  invoices: Doc[];
  quotations: Doc[];
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'invoices' | 'quotations'>('invoices');

  async function load() {
    setClient(await apiFetch<ClientDetail>(`/api/clients/${id}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openEdit() {
    if (!client) return;
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      billingAddress: client.billingAddress ?? '',
      shippingAddress: client.shippingAddress ?? '',
      gstin: client.gstin ?? '',
      notes: client.notes ?? ''
    });
    setShowEdit(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(form) });
      setShowEdit(false);
      toast.success('Client updated.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this client? Only possible if they have no invoices or quotations.')) return;
    try {
      await apiFetch(`/api/clients/${id}`, { method: 'DELETE' });
      toast.success('Client deleted.');
      router.push('/clients');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  if (!client) {
    return (
      <>
        <Topbar title="Client" />
        <main className="p-6 max-w-[1100px] space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
      </>
    );
  }

  const totalBilled = client.invoices
    .filter((i) => i.status !== 'CANCELLED')
    .reduce((s, i) => s + i.totalCents, 0);
  const outstanding = client.invoices
    .filter((i) => ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
    .reduce((s, i) => s + (i.balanceDueCents ?? 0), 0);

  const docs = tab === 'invoices' ? client.invoices : client.quotations;

  return (
    <>
      <Topbar
        title={client.name}
        subtitle="Client"
        actions={
          <>
            <Link href={`/quotations/new?clientId=${client.id}`} className="btn-secondary">
              <Icon name="quotation" className="w-4 h-4" />
              <span className="hidden sm:inline">Quotation</span>
            </Link>
            <Link href={`/invoices/new?clientId=${client.id}`} className="btn-primary">
              <Icon name="plus" className="w-4 h-4" />
              Invoice
            </Link>
          </>
        }
      />

      <main className="p-6 max-w-[1100px] space-y-6">
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <span className="shrink-0">
                <Avatar name={client.name} />
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-semibold text-brand-800">{client.name}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-gold-700">
                      <Icon name="mail" className="w-3.5 h-3.5" />
                      {client.email}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-600">
                      <Icon name="alert" className="w-3.5 h-3.5" />
                      No email — reminders can&apos;t be sent
                    </span>
                  )}
                  {client.phone ? <span>{client.phone}</span> : null}
                  {client.gstin ? <span>GSTIN: {client.gstin}</span> : null}
                </div>
                {client.billingAddress ? (
                  <p className="text-sm text-gray-500 whitespace-pre-line pt-1">{client.billingAddress}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-gray-500">Total billed</p>
                <p className="text-xl font-semibold text-brand-800 tnum">{formatMoney(totalBilled)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className={`text-xl font-semibold tnum ${outstanding > 0 ? 'text-gold-700' : 'text-sprout-600'}`}>
                  {formatMoney(outstanding)}
                </p>
              </div>
              <div className="flex gap-1 border-l border-gray-200 pl-4">
                <button className="btn-ghost btn-sm" onClick={openEdit} title="Edit client">
                  <Icon name="edit" className="w-4 h-4" />
                </button>
                <button
                  className="btn-ghost btn-sm hover:text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                  title="Delete client"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100">
            {(['invoices', 'quotations'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
                  tab === key ? 'text-brand-800' : 'text-gray-500 hover:text-brand-700'
                }`}
              >
                {key}
                <span className="ml-1.5 text-xs text-gray-400">
                  {key === 'invoices' ? client.invoices.length : client.quotations.length}
                </span>
                {tab === key ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold-500" /> : null}
              </button>
            ))}
          </div>

          {docs.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-400 text-center">
              No {tab} for {client.name} yet.
            </p>
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="row-link"
                    onClick={() => router.push(`/${tab === 'invoices' ? 'invoices' : 'quotations'}/${doc.id}`)}
                  >
                    <td className="td font-medium text-brand-800">{doc.number}</td>
                    <td className="td text-xs text-gray-500 hidden sm:table-cell">
                      {doc.dueDate ? `Due ${formatDate(doc.dueDate)}` : formatDate(doc.createdAt)}
                    </td>
                    <td className="td text-right font-semibold tnum whitespace-nowrap">
                      {formatMoney(doc.totalCents, doc.currency)}
                    </td>
                    <td className="td text-right">
                      <StatusBadge status={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {showEdit && form && (
        <Modal title="Edit client" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Billing address</label>
              <textarea
                className="input"
                rows={2}
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
