import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';
import { computeDocumentTotals } from '@/lib/calc';
import { nextInvoiceNumber } from '@/lib/numbering';
import { syncOverdueStatuses } from '@/lib/reminders';

export async function GET(req: NextRequest) {
  await syncOverdueStatuses();
  const status = req.nextUrl.searchParams.get('status');
  const clientId = req.nextUrl.searchParams.get('clientId');
  const q = req.nextUrl.searchParams.get('q')?.trim();

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
      ...(q ? { OR: [{ number: { contains: q } }, { client: { name: { contains: q } } }] } : {})
    },
    include: { client: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const lines = data.items.map((l) => ({ quantity: l.quantity, rateCents: toCents(l.rate), taxPercent: l.taxPercent }));
  const totals = computeDocumentTotals(lines, data.discountType, data.discountType === 'FLAT' ? toCents(data.discountValue) : data.discountValue);

  const number = await nextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId: data.clientId,
      currency: data.currency,
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      discountType: data.discountType,
      discountValue: data.discountValue,
      notes: data.notes || null,
      terms: data.terms || null,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      balanceDueCents: totals.totalCents,
      items: {
        create: data.items.map((l, i) => {
          const computed = { quantity: l.quantity, rateCents: toCents(l.rate), taxPercent: l.taxPercent };
          const subtotal = Math.round(computed.quantity * computed.rateCents);
          const tax = Math.round((subtotal * computed.taxPercent) / 100);
          return {
            itemId: l.itemId || null,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            rateCents: computed.rateCents,
            taxPercent: l.taxPercent,
            lineSubtotalCents: subtotal,
            lineTaxCents: tax,
            lineTotalCents: subtotal + tax,
            sortOrder: i
          };
        })
      }
    },
    include: { items: true, client: true }
  });

  return NextResponse.json(invoice, { status: 201 });
}
