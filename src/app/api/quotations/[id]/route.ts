import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { quotationSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';
import { computeDocumentTotals } from '@/lib/calc';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      invoices: true
    }
  });
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(quotation);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['DRAFT'].includes(existing.status)) {
    return NextResponse.json({ error: 'Only draft quotations can be edited.' }, { status: 409 });
  }

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

  await prisma.$transaction([
    prisma.quotationItem.deleteMany({ where: { quotationId: params.id } }),
    prisma.quotation.update({
      where: { id: params.id },
      data: {
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
      }
    })
  ]);

  const quotation = await prisma.quotation.findUnique({ where: { id: params.id }, include: { items: true, client: true } });
  return NextResponse.json(quotation);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const quotation = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quotation.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft quotations can be deleted.' }, { status: 409 });
  }
  await prisma.quotation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
