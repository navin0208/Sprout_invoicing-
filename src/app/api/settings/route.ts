import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { settingsSchema } from '@/lib/validation';

// Without this, Next statically caches this route at build time (it reads
// no request data, so it looks "static" to Next's heuristics) and every
// request would keep serving that first snapshot — including a stale
// nextInvoiceNumber/nextQuoteNumber — for the life of the server process.
export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  await getSettings(); // ensure row exists
  const updated = await prisma.settings.update({
    where: { id: 1 },
    data: {
      businessName: d.businessName,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      logoDataUrl: d.logoDataUrl || null,
      gstin: d.gstin || null,
      defaultCurrency: d.defaultCurrency,
      defaultTaxName: d.defaultTaxName,
      defaultTaxPercent: d.defaultTaxPercent,
      invoicePrefix: d.invoicePrefix,
      nextInvoiceNumber: d.nextInvoiceNumber,
      quotePrefix: d.quotePrefix,
      nextQuoteNumber: d.nextQuoteNumber,
      defaultTermsInvoice: d.defaultTermsInvoice || null,
      defaultTermsQuote: d.defaultTermsQuote || null,
      upiId: d.upiId || null,
      bankDetails: d.bankDetails || null,
      reminderBeforeDaysJson: JSON.stringify(d.reminderBeforeDays),
      reminderOnDueDate: d.reminderOnDueDate,
      reminderAfterDaysJson: JSON.stringify(d.reminderAfterDays),
      reminderMaxAfterCount: d.reminderMaxAfterCount
    }
  });
  return NextResponse.json(updated);
}
