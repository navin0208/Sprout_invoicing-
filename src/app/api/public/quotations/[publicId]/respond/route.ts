import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public, unauthenticated endpoint — the client-facing quotation page posts
// here when the client clicks Accept / Decline. No auth by design (that's
// the point of the shareable link), so keep this narrowly scoped: it can
// only flip status on a quotation that's still awaiting a response.
export async function POST(req: NextRequest, { params }: { params: { publicId: string } }) {
  const body = await req.json().catch(() => ({}));
  const decision = body?.decision;
  if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  const quotation = await prisma.quotation.findUnique({ where: { publicId: params.publicId } });
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['SENT', 'VIEWED'].includes(quotation.status)) {
    return NextResponse.json({ error: 'This quotation has already been responded to.' }, { status: 409 });
  }

  const updated = await prisma.quotation.update({
    where: { publicId: params.publicId },
    data: {
      status: decision,
      respondedAt: new Date(),
      clientNote: typeof body?.note === 'string' ? body.note.slice(0, 1000) : null
    }
  });

  return NextResponse.json(updated);
}
