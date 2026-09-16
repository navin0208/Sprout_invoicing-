import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { withDefaultLogo } from '@/lib/brand-server';
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument';
import { buildUpiQrDataUrl } from '@/lib/upi';
import { fromCents } from '@/lib/money';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } }
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = withDefaultLogo(await getSettings());
  const qrDataUrl =
    settings.upiId && invoice.balanceDueCents > 0
      ? await buildUpiQrDataUrl({
          upiId: settings.upiId,
          payeeName: settings.businessName,
          amount: fromCents(invoice.balanceDueCents),
          note: `Invoice ${invoice.number}`
        })
      : null;

  const buffer = await renderToBuffer(
    <InvoiceDocument invoice={invoice} business={settings} qrDataUrl={qrDataUrl} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.number}.pdf"`
    }
  });
}
