import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recomputeInvoicePaymentState } from '@/lib/invoiceStatus';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  await prisma.payment.delete({ where: { id: params.paymentId } });
  await recomputeInvoicePaymentState(params.id);
  return NextResponse.json({ ok: true });
}
