import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { itemSchema } from '@/lib/validation';
import { toCents } from '@/lib/money';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const items = await prisma.item.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: 'asc' }
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, description, unit, rate, taxPercent } = parsed.data;
  const item = await prisma.item.create({
    data: { name, description, unit, rateCents: toCents(rate), taxPercent: taxPercent ?? null }
  });
  return NextResponse.json(item, { status: 201 });
}
