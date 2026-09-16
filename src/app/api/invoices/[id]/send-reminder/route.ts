import { NextRequest, NextResponse } from 'next/server';
import { sendManualReminder } from '@/lib/reminders';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await sendManualReminder(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send reminder' },
      { status: 400 }
    );
  }
}
