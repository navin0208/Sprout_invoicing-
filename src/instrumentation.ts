// Next.js calls register() exactly once when the server process starts
// (requires experimental.instrumentationHook, set in next.config.mjs).
// We use it to start an in-process daily cron job that sweeps for due /
// overdue invoices and emails reminders. This only makes sense for a
// long-running process (`next start`, or `next dev`) — if you deploy this
// app to a serverless platform instead, disable REMINDER_CRON_ENABLED and
// point that platform's own cron feature at POST /api/cron/reminders.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.REMINDER_CRON_ENABLED === 'false') return;

  const cron = await import('node-cron');
  const { runReminderSweep } = await import('./lib/reminders');

  const hour = Math.min(23, Math.max(0, Number(process.env.REMINDER_CRON_HOUR ?? 9)));

  cron.schedule(`0 ${hour} * * *`, async () => {
    try {
      const result = await runReminderSweep('cron');
      console.log(
        `[reminders] daily sweep: checked ${result.checked}, sent ${result.sent}, failed ${result.failed}, skipped(no email) ${result.skippedNoEmail}`
      );
    } catch (err) {
      console.error('[reminders] daily sweep failed', err);
    }
  });

  console.log(`[reminders] scheduler started — runs daily at ${hour}:00 server time`);
}
