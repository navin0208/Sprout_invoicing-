import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientSchema } from '@/lib/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      invoices: { orderBy: { createdAt: 'desc' } },
      quotations: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const [invoiceCount, quoteCount] = await Promise.all([
    prisma.invoice.count({ where: { clientId: params.id } }),
    prisma.quotation.count({ where: { clientId: params.id } })
  ]);
  if (invoiceCount > 0 || quoteCount > 0) {
    return NextResponse.json(
      { error: 'This client has invoices or quotations and cannot be deleted. Archive them first.' },
      { status: 409 }
    );
  }
  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
