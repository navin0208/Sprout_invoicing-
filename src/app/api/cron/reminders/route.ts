import { NextRequest, NextResponse } from 'next/server';
import { runReminderSweep } from '@/lib/reminders';

// Alternative to the in-process node-cron scheduler (instrumentation.ts) —
// call this from an external scheduler (Windows Task Scheduler, a hosting
// provider's cron, GitHub Actions, Vercel Cron, ...) with:
//   POST /api/cron/reminders   header:  x-cron-secret: <CRON_SECRET>
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const headerSecret = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('authorization');
  return headerSecret === cronSecret || authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runReminderSweep('cron');
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runReminderSweep('cron');
  return NextResponse.json(result);
}
