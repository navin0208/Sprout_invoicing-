// Money is stored as integer minor units (paise/cents). These helpers
// convert to/from the decimal value a human types into a form.

export function toCents(value: number | string): number {
  const n = typeof value === 'string' ? parseFloat(value || '0') : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB'
};

export function formatMoney(cents: number, currency = 'INR'): string {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol'
    }).format(fromCents(cents));
  } catch {
    return `${currency} ${fromCents(cents).toFixed(2)}`;
  }
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
