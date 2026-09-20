'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { computeDocumentTotals, computeLine } from '@/lib/calc';
import { toCents, formatMoney, formatDate } from '@/lib/money';
import { amountInWords } from '@/lib/words';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  gstin: string | null;
};

type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  rateCents: number;
  taxPercent: number | null;
};

export type LineState = {
  itemId: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
};

export type QuotationEditorInitial = {
  number?: string;
  clientId: string;
  currency: string;
  issueDate: string;
  dueDate: string; // expiryDate for quotations
  discountType: 'NONE' | 'PERCENT' | 'FLAT';
  discountValue: number;
  notes: string;
  terms: string;
  items: LineState[];
};

const BLANK_LINE: LineState = {
  itemId: null,
  description: '',
  quantity: 1,
  unit: 'unit',
  rate: 0,
  taxPercent: 0
};

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function QuotationPaperEditor({
  documentId,
  initial,
  defaultClientId
}: {
  documentId?: string;
  initial?: QuotationEditorInitial;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [settings, setSettings] = useState<{
    businessName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gstin: string | null;
    logoDataUrl: string | null;
    defaultCurrency: string;
    defaultTaxPercent: number;
    defaultTermsQuote: string | null;
    quotePrefix: string;
    nextQuoteNumber: number;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    billingAddress: '',
    gstin: ''
  });
  const [savingClient, setSavingClient] = useState(false);

  // Document state
  const [quoteNumber, setQuoteNumber] = useState(initial?.number || '');
  const [clientId, setClientId] = useState(initial?.clientId ?? defaultClientId ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayISO());
  const [expiryDate, setExpiryDate] = useState(initial?.dueDate ?? todayISO(15));
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FLAT'>(initial?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [lines, setLines] = useState<LineState[]>(initial?.items?.length ? initial.items : [{ ...BLANK_LINE }]);

  // Standard terms from settings
  const [standardTerms, setStandardTerms] = useState('');

  useEffect(() => {
    apiFetch<Client[]>('/api/clients').then(setClients);
    apiFetch<CatalogItem[]>('/api/items').then(setCatalog);
    apiFetch<any>('/api/settings').then((s) => {
      setSettings(s);
      const defTerms = s.defaultTermsQuote ?? '';
      setStandardTerms(defTerms);
      if (!initial) {
        setCurrency(s.defaultCurrency || 'INR');
        setTerms(defTerms);
        if (!quoteNumber) {
          const prefix = s.quotePrefix || 'QUO-';
          const nextNo = s.nextQuoteNumber || 1;
          setQuoteNumber(`${prefix}${String(nextNo).padStart(4, '0')}`);
        }
        setLines((prev) =>
          prev.map((l) => (l.taxPercent === 0 ? { ...l, taxPercent: s.defaultTaxPercent || 0 } : l))
        );
      }
    });
  }, [initial, quoteNumber]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId) || null;
  }, [clients, clientId]);

  // Document math
  const totals = useMemo(() => {
    return computeDocumentTotals(
      lines.map((l) => ({
        quantity: Number(l.quantity) || 0,
        rateCents: toCents(l.rate),
        taxPercent: Number(l.taxPercent) || 0
      })),
      discountType,
      discountType === 'FLAT' ? toCents(discountValue) : discountValue
    );
  }, [lines, discountType, discountValue]);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        ...BLANK_LINE,
        taxPercent: settings?.defaultTaxPercent || 0
      }
    ]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function insertCatalogItem(itemId: string, lineIndex?: number) {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;

    const newLine: LineState = {
      itemId: item.id,
      description: item.description ? `${item.name}\n${item.description}` : item.name,
      quantity: 1,
      unit: item.unit || 'unit',
      rate: (item.rateCents || 0) / 100,
      taxPercent: item.taxPercent ?? settings?.defaultTaxPercent ?? 0
    };

    if (lineIndex !== undefined) {
      updateLine(lineIndex, newLine);
    } else {
      setLines((prev) => {
        // If the only line is empty, replace it
        if (prev.length === 1 && !prev[0].description && prev[0].rate === 0) {
          return [newLine];
        }
        return [...prev, newLine];
      });
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setSavingClient(true);
    try {
      const newClient = await apiFetch<Client>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(newClientForm)
      });
      setClients((prev) => [...prev, newClient]);
      setClientId(newClient.id);
      setShowClientModal(false);
      setNewClientForm({ name: '', email: '', phone: '', billingAddress: '', gstin: '' });
      toast.success(`Client "${newClient.name}" added and selected.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add client.');
    } finally {
      setSavingClient(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!clientId) {
      toast.error('Please choose or add a client for this quotation.');
      return;
    }

    if (lines.some((l) => !l.description.trim())) {
      toast.error('All line items require a description.');
      return;
    }

    const payload = {
      clientId,
      currency,
      issueDate,
      expiryDate: expiryDate || undefined,
      discountType,
      discountValue: Number(discountValue) || 0,
      notes,
      terms,
      items: lines.map((l) => ({
        itemId: l.itemId,
        description: l.description,
        quantity: Number(l.quantity) || 1,
        unit: l.unit || 'unit',
        rate: Number(l.rate) || 0,
        taxPercent: Number(l.taxPercent) || 0
      }))
    };

    setSaving(true);
    try {
      const doc = documentId
        ? await apiFetch<any>(`/api/quotations/${documentId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          })
        : await apiFetch<any>('/api/quotations', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

      toast.success(
        documentId
          ? 'Quotation updated successfully.'
          : `Quotation ${doc.number || 'document'} created successfully!`
      );
      router.push(`/quotations/${doc.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save quotation.');
    } finally {
      setSaving(false);
    }
  }

  // Keyboard shortcut: Cmd/Ctrl + S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="min-h-screen bg-slate-100/90 pb-28">
      {/* Top Floating Action Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200/90 px-4 sm:px-8 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/quotations"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand-800 transition-colors py-1 px-2.5 rounded-lg hover:bg-gray-100"
            >
              <Icon name="arrowLeft" className="w-3.5 h-3.5" />
              Back
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-brand-900">
                  {documentId ? `Edit Quotation ${quoteNumber}` : 'New Quotation'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Paper Canvas
                </span>
              </div>
              <p className="text-[11px] text-gray-400">What you edit here matches the final printed PDF 1:1</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Currency switcher */}
            <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-400 mr-1.5 font-medium">Currency:</span>
              <select
                className="bg-transparent text-xs font-semibold text-brand-800 focus:outline-hidden cursor-pointer"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={saving}
              className="btn-primary py-2 px-5 text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 transition-all"
            >
              <Icon name="check" className="w-4 h-4" />
              {saving ? 'Saving Document…' : documentId ? 'Update Quotation' : 'Save Quotation'}
              <span className="hidden sm:inline-block text-[10px] opacity-75 font-normal ml-1 bg-white/20 px-1.5 py-0.2 rounded">
                ⌘S
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {/* The Paper Sheet (A4 Proportion Canvas) */}
        <div className="bg-white rounded-md shadow-xl border border-gray-200/80 p-6 sm:p-12 relative overflow-hidden">
          {/* Subtle printed document header accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-800 via-gold-500 to-brand-800" />

          {/* Document Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-gray-100">
            {/* Left: Document Title and Meta */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-extrabold text-brand-950 tracking-tight">QUOTATION</h2>
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 tracking-wide uppercase">
                  DRAFT
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* Quotation Number */}
                <div className="flex items-center gap-2">
                  <span className="w-28 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                    Quotation No
                  </span>
                  <input
                    type="text"
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    placeholder="QUO-0001"
                    className="font-bold text-brand-900 border-b border-dashed border-gray-300 hover:border-brand-600 focus:border-brand-800 focus:outline-hidden bg-transparent px-1 py-0.5 text-xs transition-colors"
                  />
                </div>

                {/* Quotation Date */}
                <div className="flex items-center gap-2">
                  <span className="w-28 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                    Issue Date
                  </span>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                    className="font-semibold text-brand-900 border-b border-dashed border-gray-300 hover:border-brand-600 focus:border-brand-800 focus:outline-hidden bg-transparent px-1 py-0.5 text-xs transition-colors"
                  />
                  <span className="text-[11px] text-gray-400 hidden sm:inline">({formatDate(issueDate)})</span>
                </div>

                {/* Valid Till Date */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-28 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                    Valid Till
                  </span>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="font-semibold text-brand-900 border-b border-dashed border-gray-300 hover:border-brand-600 focus:border-brand-800 focus:outline-hidden bg-transparent px-1 py-0.5 text-xs transition-colors"
                  />
                  {/* Quick pills */}
                  <div className="inline-flex items-center gap-1">
                    {[7, 15, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setExpiryDate(todayISO(days))}
                        className="text-[10px] text-gray-500 hover:text-brand-900 bg-gray-100 hover:bg-gold-100 hover:border-gold-300 border border-gray-200 px-1.5 py-0.5 rounded transition-colors"
                      >
                        +{days}d
                      </button>
                    ))}
                    {expiryDate ? (
                      <button
                        type="button"
                        onClick={() => setExpiryDate('')}
                        className="text-[10px] text-gray-400 hover:text-red-500 px-1"
                        title="Clear validity date"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Business Brand & Logo */}
            <div className="flex flex-col items-start sm:items-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings?.logoDataUrl || DEFAULT_LOGO_PATH}
                alt={settings?.businessName || 'Business Logo'}
                className="h-14 sm:h-16 w-auto max-w-[200px] object-contain mb-1"
              />
              <span className="text-xs font-bold text-brand-800 tracking-tight">
                {settings?.businessName || 'The Sprout Media'}
              </span>
              {settings?.gstin ? (
                <span className="text-[11px] text-gray-500">GSTIN: {settings.gstin}</span>
              ) : null}
            </div>
          </div>

          {/* Quotation From & Quotation For (2 Panels styled identically to the PDF) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            {/* "Quotation From" Box */}
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-4 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70">
                  Quotation From
                </span>
                <Link
                  href="/settings"
                  className="text-[10px] font-medium text-amber-700 hover:underline"
                  title="Edit business profile in settings"
                >
                  Edit Profile
                </Link>
              </div>
              <p className="text-sm font-bold text-brand-950 mb-1">
                {settings?.businessName || 'The Sprout Media'}
              </p>
              {settings?.address ? (
                <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{settings.address}</p>
              ) : null}
              {settings?.email ? <p className="text-xs text-gray-600">{settings.email}</p> : null}
              {settings?.phone ? <p className="text-xs text-gray-600">{settings.phone}</p> : null}
              {settings?.gstin ? (
                <p className="text-xs text-gray-500 font-mono mt-1">GSTIN: {settings.gstin}</p>
              ) : null}
            </div>

            {/* "Quotation For" Box */}
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-4 relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70">
                    Quotation For (Client) *
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowClientModal(true)}
                    className="text-[10px] font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1 bg-white/80 hover:bg-white border border-amber-200 px-1.5 py-0.5 rounded shadow-2xs transition-colors"
                  >
                    <Icon name="plus" className="w-2.5 h-2.5" />
                    New Client
                  </button>
                </div>

                {/* Client selector dropdown */}
                <div className="mb-2">
                  <select
                    className="w-full text-xs font-semibold text-brand-900 bg-white border border-amber-300 rounded-md p-2 focus:ring-2 focus:ring-brand-500 focus:outline-hidden cursor-pointer"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Select or assign a client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Render selected client preview matching PDF layout */}
                {selectedClient ? (
                  <div className="pt-1 border-t border-amber-200/60 text-xs space-y-0.5">
                    <p className="font-bold text-brand-900">{selectedClient.name}</p>
                    {selectedClient.billingAddress ? (
                      <p className="text-gray-600 whitespace-pre-line text-[11px] leading-tight">
                        {selectedClient.billingAddress}
                      </p>
                    ) : null}
                    {selectedClient.email ? (
                      <p className="text-gray-600 text-[11px]">{selectedClient.email}</p>
                    ) : null}
                    {selectedClient.phone ? (
                      <p className="text-gray-600 text-[11px]">{selectedClient.phone}</p>
                    ) : null}
                    {selectedClient.gstin ? (
                      <p className="text-gray-500 font-mono text-[10px] mt-0.5">GSTIN: {selectedClient.gstin}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic mt-1">
                    Select a client from the dropdown above, or click &quot;+ New Client&quot; to add one.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table (Matches PDF table structure 1:1) */}
          <div className="mt-8 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Line Items &amp; Services
              </span>
              {catalog.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">Quick Catalog:</span>
                  <select
                    className="text-xs font-medium text-brand-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-2 py-1 focus:outline-hidden cursor-pointer"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) insertCatalogItem(e.target.value);
                    }}
                  >
                    <option value="">+ Insert Item from Catalog…</option>
                    {catalog.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({formatMoney(cat.rateCents, currency)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-md border border-gray-200 shadow-2xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#28232a] text-white uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 text-left">Description / Service</th>
                    <th className="py-2.5 px-2 text-right w-20">Qty</th>
                    <th className="py-2.5 px-2 text-center w-16">Unit</th>
                    <th className="py-2.5 px-3 text-right w-28">Rate ({currency})</th>
                    <th className="py-2.5 px-2 text-right w-16">Tax %</th>
                    <th className="py-2.5 px-3 text-right w-28">Amount</th>
                    <th className="py-2.5 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/70">
                  {lines.map((line, idx) => {
                    const computed = computeLine({
                      quantity: Number(line.quantity) || 0,
                      rateCents: toCents(line.rate),
                      taxPercent: Number(line.taxPercent) || 0
                    });
                    const isAlt = idx % 2 === 1;

                    return (
                      <tr
                        key={idx}
                        className={`group transition-colors ${
                          isAlt ? 'bg-amber-50/40 hover:bg-amber-50/80' : 'bg-white hover:bg-gray-50/70'
                        }`}
                      >
                        {/* Index */}
                        <td className="py-2.5 px-3 align-top text-center text-gray-400 font-semibold pt-3.5">
                          {idx + 1}.
                        </td>

                        {/* Description */}
                        <td className="py-2 px-3 align-top">
                          <div className="space-y-1">
                            <textarea
                              rows={line.description.includes('\n') ? 3 : 1}
                              value={line.description}
                              onChange={(e) => updateLine(idx, { description: e.target.value })}
                              placeholder="Service or product description… (Enter line breaks for bullet points on PDF)"
                              className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-brand-500 focus:bg-white rounded p-1.5 text-xs text-brand-900 leading-relaxed resize-y focus:outline-hidden transition-all"
                              required
                            />
                            {/* Fast catalog selector for this specific line */}
                            {catalog.length > 0 && !line.description ? (
                              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <span>Tip:</span>
                                <button
                                  type="button"
                                  onClick={() => insertCatalogItem(catalog[0]?.id, idx)}
                                  className="text-brand-600 hover:underline"
                                >
                                  Pick from catalog
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 align-top">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                            className="w-full text-right font-medium bg-transparent border border-transparent hover:border-gray-200 focus:border-brand-500 focus:bg-white rounded p-1.5 text-xs text-brand-900 tnum focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-2 align-top">
                          <input
                            type="text"
                            value={line.unit}
                            onChange={(e) => updateLine(idx, { unit: e.target.value })}
                            placeholder="unit"
                            className="w-full text-center text-gray-600 bg-transparent border border-transparent hover:border-gray-200 focus:border-brand-500 focus:bg-white rounded p-1.5 text-xs focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* Rate */}
                        <td className="py-2 px-3 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            onChange={(e) => updateLine(idx, { rate: Number(e.target.value) })}
                            className="w-full text-right font-medium bg-transparent border border-transparent hover:border-gray-200 focus:border-brand-500 focus:bg-white rounded p-1.5 text-xs text-brand-900 tnum focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* Tax % */}
                        <td className="py-2 px-2 align-top">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={line.taxPercent}
                            onChange={(e) => updateLine(idx, { taxPercent: Number(e.target.value) })}
                            className="w-full text-right text-gray-600 bg-transparent border border-transparent hover:border-gray-200 focus:border-brand-500 focus:bg-white rounded p-1.5 text-xs tnum focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* Line Total */}
                        <td className="py-2 px-3 align-top text-right font-bold text-brand-900 tnum pt-3.5 whitespace-nowrap">
                          {formatMoney(computed.lineTotalCents, currency)}
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 align-top text-center pt-2.5">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            className="text-gray-300 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors disabled:opacity-0"
                            title="Remove row"
                          >
                            <Icon name="trash" className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Add line button bar */}
              <div className="bg-gray-50/70 p-2.5 border-t border-gray-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 bg-white hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded shadow-2xs transition-all"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
                <span className="text-[11px] text-gray-400">
                  {lines.length} item{lines.length === 1 ? '' : 's'} on this quotation
                </span>
              </div>
            </div>
          </div>

          {/* Document Summary & Totals Block (Matches PDF bottom layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-6 pt-4 border-t border-gray-100">
            {/* Left: Amount in words */}
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 border border-gray-200/80 p-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Total Amount in Words
                </span>
                <p className="text-xs font-bold text-brand-900 leading-relaxed">
                  {amountInWords(totals.totalCents, currency)}
                </p>
              </div>

              {/* Discount controls */}
              <div className="p-3 rounded-lg border border-gray-200/80 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Discount Option</span>
                  <div className="inline-flex rounded-md shadow-2xs">
                    {(['NONE', 'PERCENT', 'FLAT'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDiscountType(t)}
                        className={`text-[10px] font-bold px-2.5 py-1 border first:rounded-l-md last:rounded-r-md transition-colors ${
                          discountType === t
                            ? 'bg-brand-800 text-white border-brand-800'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {t === 'NONE' ? 'None' : t === 'PERCENT' ? '% Percent' : `Flat (${currency})`}
                      </button>
                    ))}
                  </div>
                </div>

                {discountType !== 'NONE' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500">
                      {discountType === 'PERCENT' ? 'Discount Percentage' : 'Discount Amount'}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step={discountType === 'PERCENT' ? '1' : '0.01'}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-24 text-right text-xs font-bold text-brand-900 bg-gray-50 border border-gray-300 rounded p-1 focus:outline-hidden"
                      />
                      <span className="text-xs font-bold text-gray-500">
                        {discountType === 'PERCENT' ? '%' : currency}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Calculated Totals Table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-brand-900 tnum">
                  {formatMoney(totals.subtotalCents, currency)}
                </span>
              </div>

              {totals.discountCents > 0 && (
                <div className="flex justify-between py-1 text-emerald-700 font-medium">
                  <span>
                    Discount {discountType === 'PERCENT' ? `(${discountValue}%)` : ''}
                  </span>
                  <span className="tnum">-{formatMoney(totals.discountCents, currency)}</span>
                </div>
              )}

              <div className="flex justify-between py-1 text-gray-600">
                <span>Tax Estimated</span>
                <span className="font-semibold text-brand-900 tnum">
                  {formatMoney(totals.taxCents, currency)}
                </span>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-center py-3 border-t-2 border-brand-950 text-sm font-extrabold text-brand-950 mt-2">
                <span className="text-xs uppercase tracking-wider">Grand Total</span>
                <span className="text-base sm:text-lg tnum text-brand-900">
                  {formatMoney(totals.totalCents, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Terms (Direct-on-Paper Editing) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-200/90 text-xs">
            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Notes for Client (visible on quotation)
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special notes, payment milestones, or project scope overview here…"
                className="w-full rounded-md border border-gray-200 p-2.5 text-xs text-brand-900 bg-gray-50/50 hover:bg-white focus:bg-white focus:border-brand-500 focus:outline-hidden leading-relaxed transition-all resize-y"
              />
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Terms &amp; Conditions
                </label>
                {standardTerms && terms.trim() !== standardTerms.trim() && (
                  <button
                    type="button"
                    onClick={() => setTerms(standardTerms)}
                    className="text-[10px] font-semibold text-brand-700 hover:text-brand-900 underline"
                  >
                    Reset to Standard Terms
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="One term per line. E.g.&#10;1. 50% advance before project kickoff.&#10;2. Valid for 30 days."
                className="w-full rounded-md border border-gray-200 p-2.5 text-xs text-brand-900 bg-gray-50/50 hover:bg-white focus:bg-white focus:border-brand-500 focus:outline-hidden leading-relaxed transition-all resize-y"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Bar for easy mobile/desktop access */}
        <div className="flex justify-between items-center mt-6">
          <Link
            href="/quotations"
            className="btn-secondary py-2 px-4 text-xs font-semibold"
          >
            Discard &amp; Return
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="btn-primary py-2.5 px-6 text-sm font-semibold shadow-md flex items-center gap-2"
          >
            <Icon name="check" className="w-4 h-4" />
            {saving ? 'Saving Document…' : documentId ? 'Update Quotation' : 'Save Quotation'}
          </button>
        </div>
      </main>

      {/* Quick Add Client Modal */}
      {showClientModal && (
        <Modal title="Add New Client" onClose={() => setShowClientModal(false)}>
          <form onSubmit={handleCreateClient} className="space-y-3.5 text-xs">
            <div>
              <label className="label">Client / Business Name *</label>
              <input
                className="input"
                required
                autoFocus
                placeholder="Acme Technologies Pvt Ltd"
                value={newClientForm.name}
                onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="billing@acme.com"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  placeholder="+91 98765 43210"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Billing Address</label>
              <textarea
                rows={2}
                className="input"
                placeholder="Building, Street, City, State, PIN"
                value={newClientForm.billingAddress}
                onChange={(e) => setNewClientForm({ ...newClientForm, billingAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="label">GSTIN (Optional)</label>
              <input
                className="input"
                placeholder="27ABCDE1234F1Z5"
                value={newClientForm.gstin}
                onChange={(e) => setNewClientForm({ ...newClientForm, gstin: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary py-1.5 px-3"
                onClick={() => setShowClientModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingClient}
                className="btn-primary py-1.5 px-4"
              >
                {savingClient ? 'Saving…' : 'Add & Select Client'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
