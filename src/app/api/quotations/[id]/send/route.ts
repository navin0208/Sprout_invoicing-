import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isMailerConfigured, sendMail } from '@/lib/mailer';
import { getSettings } from '@/lib/settings';
import { formatMoney, formatDate } from '@/lib/money';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const quotation = await prisma.quotation.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(quotation.status)) {
    return NextResponse.json({ error: 'This quotation can no longer be sent.' }, { status: 409 });
  }
  if (!quotation.client.email) {
    return NextResponse.json({ error: 'This client has no email address on file.' }, { status: 400 });
  }
  if (!isMailerConfigured()) {
    return NextResponse.json({ error: 'SMTP is not configured on the server (.env).' }, { status: 400 });
  }

  const settings = await getSettings();
  const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/p/quotation/${quotation.publicId}`;

  await sendMail({
    to: quotation.client.email,
    subject: `Quotation ${quotation.number} from ${settings.businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto;">
        <p>Hi ${quotation.client.name || 'there'},</p>
        <p>Please find your quotation <strong>${quotation.number}</strong> from ${settings.businessName} below.</p>
        <p>Total: <strong>${formatMoney(quotation.totalCents, quotation.currency)}</strong>${
          quotation.expiryDate ? `<br/>Valid until: <strong>${formatDate(quotation.expiryDate)}</strong>` : ''
        }</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#3866f5;color:#fff;text-decoration:none;border-radius:6px;">View quotation</a></p>
        <p style="color:#666;font-size:13px;">You can accept or decline it directly from that page.</p>
      </div>`
  });

  const updated = await prisma.quotation.update({
    where: { id: params.id },
    data: {
      status: quotation.status === 'DRAFT' ? 'SENT' : quotation.status,
      sentAt: quotation.sentAt ?? new Date()
    }
  });
  return NextResponse.json(updated);
}
