import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextInvoiceNumber } from '@/lib/numbering';

// Creates a new DRAFT invoice pre-filled from a quotation's line items and
// totals.
//
// Deliberately repeatable: a quotation is agreed once, but a retainer gets
// invoiced every month, and each month's invoice needs tweaking to match
// what was actually delivered. So this can be run again and again on the
// same quotation — each run produces a fresh draft you can edit before
// sending, and the quotation keeps the full list of invoices raised off it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } }
  });
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const dueInDays = Number(body?.dueInDays ?? 14);
  const issueDate = body?.issueDate ? new Date(body.issueDate) : new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + (Number.isFinite(dueInDays) ? dueInDays : 14));

  const number = await nextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId: quotation.clientId,
      quotationId: quotation.id,
      currency: quotation.currency,
      issueDate,
      dueDate,
      discountType: quotation.discountType,
      discountValue: quotation.discountValue,
      notes: quotation.notes,
      terms: quotation.terms,
      subtotalCents: quotation.subtotalCents,
      discountCents: quotation.discountCents,
      taxCents: quotation.taxCents,
      totalCents: quotation.totalCents,
      balanceDueCents: quotation.totalCents,
      items: {
        create: quotation.items.map((item, i) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rateCents: item.rateCents,
          taxPercent: item.taxPercent,
          lineSubtotalCents: item.lineSubtotalCents,
          lineTaxCents: item.lineTaxCents,
          lineTotalCents: item.lineTotalCents,
          sortOrder: i
        }))
      }
    },
    include: { items: true, client: true }
  });

  // A declined quotation shouldn't silently flip to "converted"; anything
  // else moves to CONVERTED the first time an invoice comes off it.
  if (quotation.status !== 'REJECTED' && quotation.status !== 'CONVERTED') {
    await prisma.quotation.update({ where: { id: quotation.id }, data: { status: 'CONVERTED' } });
  }

  return NextResponse.json(invoice, { status: 201 });
}
