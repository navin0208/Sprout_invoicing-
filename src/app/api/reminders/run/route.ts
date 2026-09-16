import { NextResponse } from 'next/server';
import { runReminderSweep } from '@/lib/reminders';

// "Run reminder sweep now" button in Settings. Protected by the app's
// normal login (middleware.ts) rather than CRON_SECRET, since it's called
// from inside the authenticated dashboard.
export async function POST() {
  const result = await runReminderSweep('manual');
  return NextResponse.json(result);
}
