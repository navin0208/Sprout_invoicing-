import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { itemSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = itemSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { rate, taxPercent, ...rest } = parsed.data;
  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(rate !== undefined ? { rateCents: toCents(rate) } : {}),
      ...(taxPercent !== undefined ? { taxPercent } : {})
    }
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.item.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
