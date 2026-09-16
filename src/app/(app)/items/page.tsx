'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/Topbar';
import { Modal } from '@/components/Modal';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/money';

type Item = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  rateCents: number;
  taxPercent: number | null;
};

const EMPTY = { name: '', description: '', unit: 'unit', rate: 0, taxPercent: '' as number | string };

export default function ItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setItems(await apiFetch<Item[]>('/api/items'));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description ?? '',
      unit: item.unit,
      rate: item.rateCents / 100,
      taxPercent: item.taxPercent ?? ''
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      rate: Number(form.rate),
      taxPercent: form.taxPercent === '' ? null : Number(form.taxPercent)
    };
    try {
      if (editing) {
        await apiFetch(`/api/items/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Item updated.');
      } else {
        await apiFetch('/api/items', { method: 'POST', body: JSON.stringify(payload) });
        toast.success(`${form.name} added to your catalog.`);
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save that item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Item) {
    if (!confirm(`Remove "${item.name}" from your catalog?`)) return;
    try {
      await apiFetch(`/api/items/${item.id}`, { method: 'DELETE' });
      toast.success('Item removed.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that item.');
    }
  }

  return (
    <>
      <Topbar
        title="Items & services"
        subtitle="Your reusable catalog — add any of these to an invoice in one click"
        actions={
          <button className="btn-primary" onClick={openNew}>
            <Icon name="plus" className="w-4 h-4" />
            Add item
          </button>
        }
      />

      <main className="p-6 max-w-[1000px]">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="th">Item</th>
                <th className="th hidden sm:table-cell">Unit</th>
                <th className="th text-right">Rate</th>
                <th className="th text-right">Tax</th>
                <th className="th text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon="items"
                      title="Your catalog is empty"
                      description="Save the services you bill for most often — Content Creation, Social Media Management, Performance Marketing — and they become one-click line items."
                      actionLabel="Add your first item"
                      onAction={openNew}
                    />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="group hover:bg-gold-50/50 transition-colors">
                    <td className="td">
                      <span className="font-medium text-brand-800">{item.name}</span>
                      {item.description ? <span className="block text-xs text-gray-500">{item.description}</span> : null}
                    </td>
                    <td className="td hidden sm:table-cell text-gray-500 text-xs">{item.unit}</td>
                    <td className="td text-right font-semibold tnum whitespace-nowrap">{formatMoney(item.rateCents)}</td>
                    <td className="td text-right text-gray-500 tnum">{item.taxPercent != null ? `${item.taxPercent}%` : '—'}</td>
                    <td className="td text-right whitespace-nowrap">
                      <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(item)} title="Edit">
                          <Icon name="edit" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="btn-ghost btn-sm hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(item)}
                          title="Delete"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {showForm && (
        <Modal
          title={editing ? 'Edit item' : 'Add item'}
          description="Saved items show up in the quick-add dropdown on invoices and quotations."
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                required
                autoFocus
                placeholder="Social Media Management"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                placeholder="Optional — shown under the item name"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Unit</label>
                <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div>
                <label className="label">Rate</label>
                <input
                  className="input tnum"
                  type="number"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Tax %</label>
                <input
                  className="input tnum"
                  type="number"
                  step="0.01"
                  placeholder="18"
                  value={form.taxPercent}
                  onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save item'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
