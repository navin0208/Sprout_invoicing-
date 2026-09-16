import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isMailerConfigured, sendMail } from '@/lib/mailer';
import { getSettings } from '@/lib/settings';
import { formatMoney, formatDate } from '@/lib/money';

// Emails the invoice to the client for the first time and marks it SENT —
// from this point on it's eligible for the automatic reminder schedule.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.status !== 'DRAFT') {
    return NextResponse.json({ error: 'This invoice has already been sent.' }, { status: 409 });
  }
  if (!invoice.client.email) {
    return NextResponse.json({ error: 'This client has no email address on file.' }, { status: 400 });
  }
  if (!isMailerConfigured()) {
    return NextResponse.json({ error: 'SMTP is not configured on the server (.env).' }, { status: 400 });
  }

  const settings = await getSettings();
  const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/p/invoice/${invoice.publicId}`;

  await sendMail({
    to: invoice.client.email,
    subject: `Invoice ${invoice.number} from ${settings.businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto;">
        <p>Hi ${invoice.client.name || 'there'},</p>
        <p>Please find your invoice <strong>${invoice.number}</strong> from ${settings.businessName} below.</p>
        <p>Amount due: <strong>${formatMoney(invoice.totalCents, invoice.currency)}</strong><br/>
        Due date: <strong>${formatDate(invoice.dueDate)}</strong></p>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#3866f5;color:#fff;text-decoration:none;border-radius:6px;">View &amp; pay invoice</a></p>
        <p style="color:#666;font-size:13px;">Thank you for your business.</p>
      </div>`
  });

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: 'SENT', sentAt: new Date() }
  });
  return NextResponse.json(updated);
}
