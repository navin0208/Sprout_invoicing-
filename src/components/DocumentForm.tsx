'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { computeDocumentTotals, computeLine } from '@/lib/calc';
import { toCents, formatMoney } from '@/lib/money';
import { Icon } from './Icon';
import { useToast } from './Toast';

type Client = { id: string; name: string };
type CatalogItem = { id: string; name: string; description: string | null; unit: string; rateCents: number; taxPercent: number | null };

export type LineState = {
  itemId: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
};

export type DocumentFormValue = {
  clientId: string;
  currency: string;
  issueDate: string;
  dueDate: string; // doubles as expiryDate for quotations
  discountType: 'NONE' | 'PERCENT' | 'FLAT';
  discountValue: number;
  notes: string;
  terms: string;
  items: LineState[];
};

const BLANK_LINE: LineState = { itemId: null, description: '', quantity: 1, unit: 'unit', rate: 0, taxPercent: 0 };

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function DocumentForm({
  kind,
  documentId,
  initial,
  defaultClientId
}: {
  kind: 'invoice' | 'quotation';
  documentId?: string;
  initial?: DocumentFormValue;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState(initial?.clientId ?? defaultClientId ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayISO());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? (kind === 'invoice' ? todayISO(14) : todayISO(15)));
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FLAT'>(initial?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [lines, setLines] = useState<LineState[]>(initial?.items?.length ? initial.items : [{ ...BLANK_LINE }]);
  // The universal T&C from Settings — prefilled on new documents, and
  // re-appliable at any time from the button next to the terms box.
  const [standardTerms, setStandardTerms] = useState('');

  useEffect(() => {
    apiFetch<Client[]>('/api/clients').then(setClients);
    apiFetch<CatalogItem[]>('/api/items').then(setCatalog);
    apiFetch<{
      defaultCurrency: string;
      defaultTaxPercent: number;
      defaultTermsInvoice: string | null;
      defaultTermsQuote: string | null;
    }>('/api/settings').then((s) => {
      const theirTerms = (kind === 'invoice' ? s.defaultTermsInvoice : s.defaultTermsQuote) ?? '';
      setStandardTerms(theirTerms);
      if (!initial) {
        setCurrency(s.defaultCurrency);
        setTerms(theirTerms);
        setLines((prev) => prev.map((l) => (l.taxPercent === 0 ? { ...l, taxPercent: s.defaultTaxPercent } : l)));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(
    () =>
      computeDocumentTotals(
        lines.map((l) => ({
          quantity: Number(l.quantity) || 0,
          rateCents: toCents(l.rate),
          taxPercent: Number(l.taxPercent) || 0
        })),
        discountType,
        discountType === 'FLAT' ? toCents(discountValue) : discountValue
      ),
    [lines, discountType, discountValue]
  );

  function updateLine(i: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addBulletToLine(i: number, currentVal: string) {
    const nextVal = currentVal ? currentVal.trimEnd() + '\n• ' : '• ';
    updateLine(i, { description: nextVal });
  }

  function handleLineKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, i: number, currentVal: string) {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const textBefore = currentVal.slice(0, selStart);
      const textAfter = currentVal.slice(selEnd);

      const lastLineBreak = textBefore.lastIndexOf('\n');
      const currentLine = lastLineBreak === -1 ? textBefore : textBefore.slice(lastLineBreak + 1);

      const bulletMatch = currentLine.match(/^(\s*)([•\-\*])\s*(.*)$/);

      if (bulletMatch) {
        e.preventDefault();
        const [_, indent, bullet, content] = bulletMatch;
        if (!content.trim()) {
          const newTextBefore = lastLineBreak === -1 ? '' : textBefore.slice(0, lastLineBreak + 1);
          const nextVal = newTextBefore + textAfter;
          updateLine(i, { description: nextVal });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          const insertion = `\n${indent}${bullet} `;
          const nextVal = textBefore + insertion + textAfter;
          updateLine(i, { description: nextVal });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
          }, 0);
        }
      }
    }
  }

  function handleAddBulletToTerms() {
    setTerms((prev) => (prev ? prev.trimEnd() + '\n• ' : '• '));
  }

  function handleTermsKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const textBefore = terms.slice(0, selStart);
      const textAfter = terms.slice(selEnd);

      const lastLineBreak = textBefore.lastIndexOf('\n');
      const currentLine = lastLineBreak === -1 ? textBefore : textBefore.slice(lastLineBreak + 1);

      const bulletMatch = currentLine.match(/^(\s*)([•\-\*])\s*(.*)$/);

      if (bulletMatch) {
        e.preventDefault();
        const [_, indent, bullet, content] = bulletMatch;
        if (!content.trim()) {
          const newTextBefore = lastLineBreak === -1 ? '' : textBefore.slice(0, lastLineBreak + 1);
          const nextVal = newTextBefore + textAfter;
          setTerms(nextVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          const insertion = `\n${indent}${bullet} `;
          const nextVal = textBefore + insertion + textAfter;
          setTerms(nextVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
          }, 0);
        }
      }
    }
  }

  function addFromCatalog(itemId: string) {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    setLines((prev) => [
      ...prev.filter((l) => l.description.trim() || l.rate > 0),
      {
        itemId: item.id,
        description: item.description ? `${item.name}\n${item.description}` : item.name,
        quantity: 1,
        unit: item.unit,
        rate: item.rateCents / 100,
        taxPercent: item.taxPercent ?? 0
      }
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientId) return toast.error('Choose a client first.');
    if (lines.some((l) => !l.description.trim())) return toast.error('Every line needs a description.');

    const payload: any = {
      clientId,
      currency,
      issueDate,
      discountType,
      discountValue: Number(discountValue) || 0,
      notes,
      terms,
      items: lines.map((l) => ({
        itemId: l.itemId,
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        rate: Number(l.rate),
        taxPercent: Number(l.taxPercent)
      }))
    };
    if (kind === 'invoice') payload.dueDate = dueDate;
    else payload.expiryDate = dueDate || undefined;

    setSaving(true);
    try {
      const base = kind === 'invoice' ? '/api/invoices' : '/api/quotations';
      const doc = documentId
        ? await apiFetch<any>(`${base}/${documentId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch<any>(base, { method: 'POST', body: JSON.stringify(payload) });
      toast.success(documentId ? 'Changes saved.' : `${kind === 'invoice' ? 'Invoice' : 'Quotation'} ${doc.number} created.`);
      router.push(kind === 'invoice' ? `/invoices/${doc.id}` : `/quotations/${doc.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-28">
      <section className="card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label">Client *</label>
            {clients.length === 0 ? (
              <a href="/clients" className="btn-secondary w-full justify-start text-gray-500">
                <Icon name="plus" className="w-4 h-4" />
                Add a client first
              </a>
            ) : (
              <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Issue date</label>
            <input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">{kind === 'invoice' ? 'Due date *' : 'Valid until'}</label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required={kind === 'invoice'}
            />
            {kind === 'invoice' ? (
              <div className="flex gap-1 mt-1.5">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDueDate(todayISO(days))}
                    className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500 hover:border-gold-400 hover:text-brand-800 transition-colors"
                  >
                    +{days}d
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="section-title">Line items</h3>
          {catalog.length > 0 && (
            <select
              className="input w-auto text-xs py-1.5"
              value=""
              onChange={(e) => e.target.value && addFromCatalog(e.target.value)}
            >
              <option value="">+ Add from catalog…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatMoney(c.rateCents, currency)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2 bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <span className="col-span-4">Description</span>
          <span className="col-span-1 text-right">Qty</span>
          <span className="col-span-1">Unit</span>
          <span className="col-span-2 text-right">Rate</span>
          <span className="col-span-1 text-right">Tax %</span>
          <span className="col-span-2 text-right">Amount</span>
          <span className="col-span-1" />
        </div>

        <div className="divide-y divide-gray-100">
          {lines.map((line, i) => {
            const computed = computeLine({
              quantity: Number(line.quantity) || 0,
              rateCents: toCents(line.rate),
              taxPercent: Number(line.taxPercent) || 0
            });
            return (
              <div key={i} className="group grid grid-cols-12 gap-3 px-5 py-3 items-start hover:bg-gold-50/40 transition-colors">
                <div className="col-span-12 lg:col-span-5 space-y-1">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold text-gray-700">Description &amp; Deliverables</span>
                    <button
                      type="button"
                      onClick={() => addBulletToLine(i, line.description)}
                      className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                      title="Add bullet point"
                    >
                      <span className="font-bold">•</span> Add Bullet
                    </button>
                  </div>
                  <textarea
                    className="input resize-y min-h-[140px] text-xs sm:text-sm p-3 leading-relaxed"
                    rows={line.description.includes('\n') ? 6 : 4}
                    placeholder="What are you billing for? (Press Enter to continue bullet points)"
                    value={line.description}
                    onKeyDown={(e) => handleLineKeyDown(e, i, line.description)}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-3 lg:col-span-1">
                  <input
                    className="input tnum text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-3 lg:col-span-1">
                  <input className="input" placeholder="unit" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                </div>
                <div className="col-span-3 lg:col-span-2">
                  <input
                    className="input tnum text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.rate}
                    onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-3 lg:col-span-1">
                  <input
                    className="input tnum text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.taxPercent}
                    onChange={(e) => updateLine(i, { taxPercent: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-9 lg:col-span-2 flex items-center justify-end pt-2 lg:pt-2.5">
                  <span className="text-sm font-semibold text-brand-800 tnum">
                    {formatMoney(computed.lineTotalCents, currency)}
                  </span>
                </div>
                <div className="col-span-3 lg:col-span-1 flex justify-end pt-1 lg:pt-1.5">
                  <button
                    type="button"
                    disabled={lines.length === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-0 transition-all lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                    aria-label="Remove line"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setLines((prev) => [...prev, { ...BLANK_LINE }])}>
            <Icon name="plus" className="w-3.5 h-3.5" />
            Add line
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card p-5 space-y-4">
          <div>
            <label className="label">Notes (visible to the client)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Thanks for working with us…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label className="text-xs font-medium text-gray-500">Terms &amp; conditions</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
                  onClick={handleAddBulletToTerms}
                  title="Add bullet point"
                >
                  <span className="text-sm font-bold leading-none">•</span> Add Bullet Point
                </button>
                {standardTerms && terms.trim() !== standardTerms.trim() ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-brand-600 hover:text-gold-700 inline-flex items-center gap-1"
                    onClick={() => setTerms(standardTerms)}
                    title="Replace with the standard terms from Settings"
                  >
                    <Icon name="copy" className="w-3 h-3" />
                    Use my standard terms
                  </button>
                ) : null}
              </div>
            </div>
            <textarea
              className="input resize-y min-h-[120px] text-xs leading-relaxed"
              rows={5}
              placeholder="• One per line (Press Enter to continue bullet points)"
              value={terms}
              onKeyDown={handleTermsKeyDown}
              onChange={(e) => setTerms(e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              {standardTerms
                ? 'Prefilled from your standard terms — edit freely, it only affects this document.'
                : 'Tip: set standard terms in Settings and they’ll fill in automatically next time.'}
            </p>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <select className="input w-40" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
              <option value="NONE">No discount</option>
              <option value="PERCENT">Discount %</option>
              <option value="FLAT">Discount (flat)</option>
            </select>
            {discountType !== 'NONE' && (
              <input
                className="input tnum"
                type="number"
                step="0.01"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Subtotal</dt>
              <dd className="tnum">{formatMoney(totals.subtotalCents, currency)}</dd>
            </div>
            {totals.discountCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Discount</dt>
                <dd className="tnum text-gold-700">-{formatMoney(totals.discountCents, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Tax</dt>
              <dd className="tnum">{formatMoney(totals.taxCents, currency)}</dd>
            </div>
            <div className="flex justify-between text-lg font-semibold text-brand-800 border-t border-gray-200 pt-2.5 mt-2.5">
              <dt>Total</dt>
              <dd className="tnum">{formatMoney(totals.totalCents, currency)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Always-visible save bar — no hunting for the button at the bottom of a long form */}
      <div className="fixed bottom-0 left-60 right-0 z-40 border-t border-gray-200 bg-white/90 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4">
        <div className="text-sm">
          <span className="text-gray-500">Total</span>{' '}
          <span className="font-semibold text-brand-800 tnum text-base">{formatMoney(totals.totalCents, currency)}</span>
          <span className="text-gray-400 text-xs ml-2">
            {lines.length} line{lines.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Icon name="check" className="w-4 h-4" />
            {saving ? 'Saving…' : documentId ? 'Save changes' : `Create ${kind}`}
          </button>
        </div>
      </div>
    </form>
  );
}
