import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';
import { computeDocumentTotals } from '@/lib/calc';
import { recomputeInvoicePaymentState } from '@/lib/invoiceStatus';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { date: 'desc' } },
      reminders: { orderBy: { sentAt: 'desc' } },
      quotation: true
    }
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { _count: { select: { payments: true } } }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Editable right up until money is involved. A monthly retainer invoice
  // often needs adjusting after it's raised (and sometimes after it's been
  // sent) to match what was actually delivered — but once a payment is
  // recorded against it, changing the amounts would break the payment trail,
  // and a cancelled invoice is a closed record.
  if (existing.status === 'CANCELLED') {
    return NextResponse.json({ error: 'A cancelled invoice can’t be edited.' }, { status: 409 });
  }
  if (existing._count.payments > 0) {
    return NextResponse.json(
      {
        error:
          'This invoice already has a payment recorded against it. Remove the payment first, or cancel it and raise a new one.'
      },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const lines = data.items.map((l) => ({ quantity: l.quantity, rateCents: toCents(l.rate), taxPercent: l.taxPercent }));
  const totals = computeDocumentTotals(lines, data.discountType, data.discountType === 'FLAT' ? toCents(data.discountValue) : data.discountValue);

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } }),
    prisma.invoice.update({
      where: { id: params.id },
      data: {
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

  await recomputeInvoicePaymentState(params.id);

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: true, client: true }
  });
  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Only draft invoices can be deleted. Cancel it instead to keep the record.' },
      { status: 409 }
    );
  }
  await prisma.invoice.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
