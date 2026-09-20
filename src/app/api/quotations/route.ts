import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { quotationSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';
import { computeDocumentTotals } from '@/lib/calc';
import { nextQuoteNumber } from '@/lib/numbering';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  const clientId = req.nextUrl.searchParams.get('clientId');
  const q = req.nextUrl.searchParams.get('q')?.trim();

  const quotations = await prisma.quotation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
      ...(q ? { OR: [{ number: { contains: q } }, { client: { name: { contains: q } } }] } : {})
    },
    include: { client: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(quotations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = quotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const lines = data.items.map((l) => ({ quantity: l.quantity, rateCents: toCents(l.rate), taxPercent: l.taxPercent }));
  const totals = computeDocumentTotals(
    lines,
    data.discountType,
    data.discountType === 'FLAT' ? toCents(data.discountValue) : data.discountValue
  );

  const number = await nextQuoteNumber();

  const quotation = await prisma.quotation.create({
    data: {
      number,
      clientId: data.clientId,
      currency: data.currency,
      issueDate: new Date(data.issueDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      notes: data.notes || null,
      terms: data.terms || null,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      items: {
        create: data.items.map((l, i) => {
          const rateCents = toCents(l.rate);
          const subtotal = Math.round(l.quantity * rateCents);
          const tax = Math.round((subtotal * l.taxPercent) / 100);
          return {
            itemId: l.itemId || null,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            rateCents,
            taxPercent: l.taxPercent,
            lineSubtotalCents: subtotal,
            lineTaxCents: tax,
            lineTotalCents: subtotal + tax,
            sortOrder: i
          };
        })
      }
    },
    include: { items: true, client: true, invoices: true }
  });

  return NextResponse.json(quotation, { status: 201 });
}
