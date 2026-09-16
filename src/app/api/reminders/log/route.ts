import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Recent reminder activity across all invoices, for the Settings page.
// force-dynamic: this route reads no request data, so Next would otherwise
// statically cache the first response for the life of the server process.
export const dynamic = 'force-dynamic';

export async function GET() {
  const logs = await prisma.reminderLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: 50,
    include: { invoice: { select: { number: true, client: { select: { name: true } } } } }
  });
  return NextResponse.json(logs);
}
