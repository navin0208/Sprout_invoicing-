import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.status === 'PAID') {
    return NextResponse.json({ error: 'A fully paid invoice cannot be cancelled.' }, { status: 409 });
  }
  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() }
  });
  return NextResponse.json(updated);
}
