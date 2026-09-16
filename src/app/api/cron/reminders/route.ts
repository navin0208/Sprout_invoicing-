import { NextRequest, NextResponse } from 'next/server';
import { runReminderSweep } from '@/lib/reminders';

// Alternative to the in-process node-cron scheduler (instrumentation.ts) —
// call this from an external scheduler (Windows Task Scheduler, a hosting
// provider's cron, GitHub Actions, Vercel Cron, ...) with:
//   POST /api/cron/reminders   header:  x-cron-secret: <CRON_SECRET>
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runReminderSweep('cron');
  return NextResponse.json(result);
}
