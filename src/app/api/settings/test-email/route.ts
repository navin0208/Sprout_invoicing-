import { NextRequest, NextResponse } from 'next/server';
import { isMailerConfigured, sendMail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  if (!isMailerConfigured()) {
    return NextResponse.json({ error: 'SMTP is not configured in .env yet.' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const to = body?.to;
  if (!to || typeof to !== 'string') {
    return NextResponse.json({ error: 'Provide an email address to send the test to.' }, { status: 400 });
  }
  try {
    await sendMail({
      to,
      subject: 'Test email from your invoicing app',
      html: '<p>If you can read this, SMTP is set up correctly and reminder emails will go out.</p>'
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 });
  }
}
