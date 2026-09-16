import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { withDefaultLogo } from '@/lib/brand-server';
import { QuotationDocument } from '@/lib/pdf/QuotationDocument';

export async function GET(_req: NextRequest, { params }: { params: { publicId: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { publicId: params.publicId },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } }
  });
  if (!quotation || quotation.status === 'DRAFT') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = withDefaultLogo(await getSettings());
  const buffer = await renderToBuffer(<QuotationDocument quotation={quotation} business={settings} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quotation.number}.pdf"`
    }
  });
}
