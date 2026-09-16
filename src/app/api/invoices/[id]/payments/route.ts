import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { paymentSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';
import { recomputeInvoicePaymentState } from '@/lib/invoiceStatus';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Send the invoice before recording a payment.' }, { status: 409 });
  }

  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { amount, date, method, note } = parsed.data;

  await prisma.payment.create({
    data: { invoiceId: params.id, amountCents: toCents(amount), date: new Date(date), method, note: note || null }
  });
  await recomputeInvoicePaymentState(params.id);

  const updated = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { payments: { orderBy: { date: 'desc' } } }
  });
  return NextResponse.json(updated, { status: 201 });
}
