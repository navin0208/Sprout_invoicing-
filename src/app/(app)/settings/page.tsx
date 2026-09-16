'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/Topbar';
import { Icon, IconName } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/money';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';

type Settings = {
  businessName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoDataUrl: string | null;
  gstin: string | null;
  defaultCurrency: string;
  defaultTaxName: string;
  defaultTaxPercent: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  quotePrefix: string;
  nextQuoteNumber: number;
  defaultTermsInvoice: string | null;
  defaultTermsQuote: string | null;
  upiId: string | null;
  bankDetails: string | null;
  reminderBeforeDaysJson: string;
  reminderOnDueDate: boolean;
  reminderAfterDaysJson: string;
  reminderMaxAfterCount: number;
};

type ReminderLogEntry = {
  id: string;
  type: string;
  sentAt: string;
  success: boolean;
  error: string | null;
  invoice: { number: string; client: { name: string } };
};

const BEFORE_OPTIONS = [1, 2, 3, 5, 7, 14];
const AFTER_OPTIONS = [1, 3, 7, 14, 21, 30];

function Section({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description?: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="w-9 h-9 rounded-lg bg-gold-50 text-gold-700 flex items-center justify-center shrink-0">
          <Icon name={icon} className="w-4 h-4" />
        </span>
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? <p className="text-xs text-gray-500 mt-0.5">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

// One term per line in, a numbered list out — the same shape they'll take on
// the PDF, so there's no guessing how the text will land.
function TermsEditor({
  label,
  hint,
  value,
  onChange,
  placeholder
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const lines = value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label className="text-sm font-medium text-brand-800">{label}</label>
        <span className="text-xs text-gray-400">
          {lines.length} term{lines.length === 1 ? '' : 's'} · one per line
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <textarea className="input font-mono text-xs leading-relaxed" rows={5} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {lines.length > 0 ? (
        <div className="mt-2.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">How it appears on the document</p>
          <ol className="space-y-1">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-2 text-xs text-brand-700">
                <span className="text-gray-400 tnum shrink-0">{i + 1}.</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function DayChip({ value, active, onToggle }: { value: number; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'bg-brand-800 text-white shadow-sm'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-gold-400 hover:text-brand-800'
      }`}
    >
      {value}d
    </button>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [logs, setLogs] = useState<ReminderLogEntry[]>([]);

  async function load() {
    const s = await apiFetch<Settings>('/api/settings');
    const sorted = (json: string) => (JSON.parse(json || '[]') as number[]).sort((a, b) => a - b);
    setForm({
      ...s,
      // sorted so the plain-English preview below reads "1, 3 days before"
      reminderBeforeDays: sorted(s.reminderBeforeDaysJson),
      reminderAfterDays: sorted(s.reminderAfterDaysJson)
    });
    setLogs(await apiFetch<ReminderLogEntry[]>('/api/reminders/log'));
  }

  useEffect(() => {
    load();
  }, []);

  function toggleDay(field: 'reminderBeforeDays' | 'reminderAfterDays', value: number) {
    setForm((f: any) => {
      const list: number[] = f[field];
      return {
        ...f,
        [field]: list.includes(value) ? list.filter((d) => d !== value) : [...list, value].sort((a, b) => a - b)
      };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          defaultTaxPercent: Number(form.defaultTaxPercent),
          nextInvoiceNumber: Number(form.nextInvoiceNumber),
          nextQuoteNumber: Number(form.nextQuoteNumber),
          reminderMaxAfterCount: Number(form.reminderMaxAfterCount)
        })
      });
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <>
        <Topbar title="Settings" />
        <main className="p-6 max-w-3xl space-y-5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
      </>
    );
  }

  const before: number[] = form.reminderBeforeDays;
  const after: number[] = form.reminderAfterDays;
  const schedulePreview = [
    before.length ? `${before.join(', ')} day${before.length > 1 || before[0] !== 1 ? 's' : ''} before it’s due` : null,
    form.reminderOnDueDate ? 'on the due date' : null,
    after.length ? `then ${after.join(', ')} days after — up to ${form.reminderMaxAfterCount} times` : null
  ].filter(Boolean);

  return (
    <>
      <Topbar
        title="Settings"
        subtitle="Your business details, numbering, and how reminders behave"
        actions={
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <main className="p-6 max-w-3xl space-y-5">
        <form onSubmit={handleSave} className="space-y-5">
          <Section title="Business profile" description="Shown on every invoice and quotation you send" icon="sprout">
            <div className="flex items-center gap-4 mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoDataUrl || DEFAULT_LOGO_PATH}
                alt="Logo"
                className="w-20 h-14 object-contain rounded-lg border border-gray-200 bg-white p-1.5"
              />
              <div className="space-y-1.5">
                <label className="btn-secondary btn-sm cursor-pointer inline-flex">
                  <Icon name="edit" className="w-3.5 h-3.5" />
                  Replace logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setForm({ ...form, logoDataUrl: await fileToDataUrl(file) });
                    }}
                  />
                </label>
                {form.logoDataUrl ? (
                  <button
                    type="button"
                    className="block text-xs text-gray-500 hover:text-gold-700"
                    onClick={() => setForm({ ...form, logoDataUrl: null })}
                  >
                    Reset to the Sprout Media logo
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">Using the default Sprout Media logo.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Business name *</label>
                <input
                  className="input"
                  required
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">GSTIN</label>
                <input className="input" value={form.gstin ?? ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.address ?? ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </Section>

          <Section title="Numbering & tax" description="Defaults applied to each new document" icon="invoice">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="label">Invoice prefix</label>
                <input
                  className="input"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Next number</label>
                <input
                  className="input tnum"
                  type="number"
                  value={form.nextInvoiceNumber}
                  onChange={(e) => setForm({ ...form, nextInvoiceNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Quote prefix</label>
                <input
                  className="input"
                  value={form.quotePrefix}
                  onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Next number</label>
                <input
                  className="input tnum"
                  type="number"
                  value={form.nextQuoteNumber}
                  onChange={(e) => setForm({ ...form, nextQuoteNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={form.defaultCurrency}
                  onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
                >
                  {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Default tax %</label>
                <input
                  className="input tnum"
                  type="number"
                  step="0.01"
                  value={form.defaultTaxPercent}
                  onChange={(e) => setForm({ ...form, defaultTaxPercent: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex items-end">
                <p className="text-xs text-gray-400">
                  Next invoice will be{' '}
                  <span className="font-medium text-brand-700">
                    {form.invoicePrefix}
                    {String(form.nextInvoiceNumber).padStart(4, '0')}
                  </span>
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Standard terms & conditions"
            description="Filled in automatically on every new quotation and invoice — you can still change them on any single document"
            icon="quotation"
          >
            <div className="space-y-6">
              <TermsEditor
                label="Quotation terms"
                hint="Your universal T&C — payment split, scope, revisions, what isn't included."
                value={form.defaultTermsQuote ?? ''}
                onChange={(v) => setForm({ ...form, defaultTermsQuote: v })}
                placeholder={
                  'Ads spend will be billed to the client directly.\nWork begins after 50% advance payment.\nThis quotation is valid for 15 days.'
                }
              />
              <TermsEditor
                label="Invoice terms"
                hint="Usually shorter — payment window, late fees, bank details reminder."
                value={form.defaultTermsInvoice ?? ''}
                onChange={(v) => setForm({ ...form, defaultTermsInvoice: v })}
                placeholder={'Payment due within 14 days of the invoice date.\nPlease quote the invoice number with your payment.'}
              />
            </div>
          </Section>

          <Section title="Getting paid" description="How clients can pay you — both appear on the invoice" icon="wallet">
            <div className="space-y-4">
              <div>
                <label className="label">UPI ID</label>
                <input
                  className="input"
                  placeholder="yourname@bank"
                  value={form.upiId ?? ''}
                  onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  {form.upiId ? '✓ A scan-to-pay QR code is added to unpaid invoices.' : 'Add one to put a scan-to-pay QR code on invoices.'}
                </p>
              </div>
              <div>
                <label className="label">Bank details</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Account name, A/C no., IFSC, bank & branch"
                  value={form.bankDetails ?? ''}
                  onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Automatic reminders"
            description="A daily check emails clients about invoices that are due or overdue"
            icon="bell"
          >
            <div className="space-y-5">
              <div>
                <label className="label">Remind before the due date</label>
                <div className="flex flex-wrap gap-1.5">
                  {BEFORE_OPTIONS.map((d) => (
                    <DayChip key={d} value={d} active={before.includes(d)} onToggle={() => toggleDay('reminderBeforeDays', d)} />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <span className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={form.reminderOnDueDate}
                    onChange={(e) => setForm({ ...form, reminderOnDueDate: e.target.checked })}
                  />
                  <span className="block w-9 h-5 rounded-full bg-gray-200 peer-checked:bg-brand-800 transition-colors" />
                  <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </span>
                <span className="text-sm text-brand-700">Also remind on the due date itself</span>
              </label>

              <div>
                <label className="label">Keep reminding after it&apos;s overdue</label>
                <div className="flex flex-wrap gap-1.5">
                  {AFTER_OPTIONS.map((d) => (
                    <DayChip key={d} value={d} active={after.includes(d)} onToggle={() => toggleDay('reminderAfterDays', d)} />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-brand-700">Stop after</label>
                <input
                  className="input tnum w-20"
                  type="number"
                  min={0}
                  value={form.reminderMaxAfterCount}
                  onChange={(e) => setForm({ ...form, reminderMaxAfterCount: e.target.value })}
                />
                <span className="text-sm text-brand-700">overdue reminders</span>
              </div>

              <div className="rounded-xl bg-gold-50 border border-gold-200 p-4 flex gap-3">
                <Icon name="mail" className="w-4 h-4 text-gold-700 shrink-0 mt-0.5" />
                <p className="text-sm text-brand-700">
                  {schedulePreview.length ? (
                    <>
                      We&apos;ll email the client <strong className="font-semibold">{schedulePreview.join(', ')}</strong>. Reminders
                      stop as soon as the invoice is paid.
                    </>
                  ) : (
                    'No automatic reminders are scheduled — pick at least one day above.'
                  )}
                </p>
              </div>
            </div>
          </Section>
        </form>

        <Section title="Email delivery" description="SMTP credentials live in the server's .env file, never in the database" icon="send">
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1 min-w-[200px]"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                try {
                  await apiFetch('/api/settings/test-email', { method: 'POST', body: JSON.stringify({ to: testEmail }) });
                  toast.success(`Test email sent to ${testEmail}.`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not send.');
                }
              }}
            >
              <Icon name="send" className="w-4 h-4" />
              Send test
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                try {
                  const r = await apiFetch<any>('/api/reminders/run', { method: 'POST' });
                  toast.success(`Sweep done — ${r.checked} checked, ${r.sent} sent, ${r.failed} failed.`);
                  load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not run the sweep.');
                }
              }}
            >
              <Icon name="bell" className="w-4 h-4" />
              Run sweep now
            </button>
          </div>
        </Section>

        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="section-title">Recent reminder activity</h2>
          </div>
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No reminders have gone out yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Icon
                    name={l.success ? 'mail' : 'alert'}
                    className={`w-4 h-4 shrink-0 ${l.success ? 'text-gray-400' : 'text-red-500'}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-brand-700">
                      {l.invoice.number} · {l.invoice.client.name}
                    </span>
                    {!l.success ? <span className="block text-xs text-red-600 truncate">Failed: {l.error}</span> : null}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(l.sentAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
