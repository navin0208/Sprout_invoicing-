'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/money';

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  outstandingCents: number;
  hasOverdue: boolean;
  _count: { invoices: number; quotations: number };
};

const EMPTY = { name: '', email: '', phone: '', billingAddress: '', shippingAddress: '', gstin: '', notes: '' };

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await apiFetch<Client[]>('/api/clients');
    setClients(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm(EMPTY);
      toast.success(`${form.name} added.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save that client.');
    } finally {
      setSaving(false);
    }
  }

  const visible = clients.filter((c) =>
    q ? [c.name, c.email, c.phone].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()) : true
  );
  const totalOutstanding = clients.reduce((s, c) => s + c.outstandingCents, 0);

  return (
    <>
      <Topbar
        title="Clients"
        subtitle={loading ? undefined : `${clients.length} client${clients.length === 1 ? '' : 's'} · ${formatMoney(totalOutstanding)} owed to you`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/api/export/excel?type=clients"
              download
              className="btn-secondary"
              title="Export all clients to Excel"
            >
              <Icon name="fileSpreadsheet" className="w-4 h-4 text-emerald-600" />
              Export Excel
            </a>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Icon name="plus" className="w-4 h-4" />
              Add client
            </button>
          </div>
        }
      />

      <main className="p-6 max-w-[1400px] space-y-4">
        <div className="relative max-w-sm">
          <Icon name="search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-28 mb-2" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="card">
            <EmptyState
              title={q ? 'No clients match that' : 'No clients yet'}
              description={
                q ? 'Try a different name, email or phone number.' : 'Add a client once, then reuse them on every invoice and quotation.'
              }
              actionLabel={q ? undefined : 'Add your first client'}
              onAction={q ? undefined : () => setShowForm(true)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="card card-hover p-5 block group">
                <div className="flex items-start gap-3 mb-4">
                  <Avatar name={client.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-800 truncate group-hover:text-gold-700 transition-colors">
                      {client.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{client.email || client.phone || 'No contact details'}</p>
                  </div>
                  <Icon
                    name="chevronRight"
                    className="w-4 h-4 text-gray-300 group-hover:text-gold-600 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500">
                    {client._count.invoices} invoice{client._count.invoices === 1 ? '' : 's'} · {client._count.quotations} quote
                    {client._count.quotations === 1 ? '' : 's'}
                  </span>
                  {client.outstandingCents > 0 ? (
                    <span
                      className={`badge ${client.hasOverdue ? 'bg-red-50 text-red-700' : 'bg-gold-100 text-gold-800'} tnum`}
                    >
                      {formatMoney(client.outstandingCents)} due
                    </span>
                  ) : (
                    <span className="badge bg-sprout-50 text-sprout-600">
                      <Icon name="check" className="w-3 h-3" />
                      Settled
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <Modal title="Add client" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                required
                autoFocus
                placeholder="Acme Studio"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="billing@acme.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <p className="text-[11px] text-gray-400 mt-1">Reminders go here.</p>
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
              <label className="label">GSTIN (optional)</label>
              <input className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save client'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
