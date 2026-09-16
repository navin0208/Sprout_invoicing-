// Converts an amount into words for the "Amount in words" line on
// invoice/quotation PDFs. Uses the Indian numbering system (lakh/crore) for
// INR since that's what most Indian small-business invoices expect, and a
// plain international system for everything else.

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? ONES[h] + ' Hundred' + (rest ? ' ' : '') : ''}${rest ? twoDigits(rest) : ''}`;
}

function indianInteger(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ');
}

function internationalInteger(n: number): string {
  if (n === 0) return 'Zero';
  const groups = ['', ' Thousand', ' Million', ' Billion', ' Trillion'];
  let i = 0;
  const parts: string[] = [];
  while (n > 0 && i < groups.length) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${threeDigits(chunk)}${groups[i]}`);
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(' ');
}

const CURRENCY_UNIT: Record<string, [string, string]> = {
  INR: ['Rupees', 'Paise'],
  USD: ['Dollars', 'Cents'],
  EUR: ['Euros', 'Cents'],
  GBP: ['Pounds', 'Pence']
};

export function amountInWords(cents: number, currency = 'INR'): string {
  const [majorUnit, minorUnit] = CURRENCY_UNIT[currency] ?? [currency, 'Cents'];
  const major = Math.floor(Math.abs(cents) / 100);
  const minor = Math.round(Math.abs(cents) % 100);
  const useIndian = currency === 'INR';
  const majorWords = useIndian ? indianInteger(major) : internationalInteger(major);

  let result = `${majorWords} ${majorUnit}`;
  if (minor > 0) {
    const minorWords = useIndian ? indianInteger(minor) : internationalInteger(minor);
    result += ` and ${minorWords} ${minorUnit}`;
  }
  return `${result} Only`;
}
