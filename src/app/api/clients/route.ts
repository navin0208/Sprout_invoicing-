import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const clients = await prisma.client.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
      : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { invoices: true, quotations: true } },
      // Only the unpaid balances, so the list can show what each client owes.
      invoices: {
        where: { status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { balanceDueCents: true, status: true }
      }
    }
  });

  return NextResponse.json(
    clients.map(({ invoices, ...client }) => ({
      ...client,
      outstandingCents: invoices.reduce((sum, inv) => sum + inv.balanceDueCents, 0),
      hasOverdue: invoices.some((inv) => inv.status === 'OVERDUE')
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const client = await prisma.client.create({ data: parsed.data });
  return NextResponse.json(client, { status: 201 });
}
