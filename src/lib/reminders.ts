import { prisma } from './prisma';
import { getSettings, parseDayOffsets } from './settings';
import { isMailerConfigured, sendMail } from './mailer';
import { formatMoney, formatDate } from './money';

const ACTIVE_STATUSES = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'];

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(a) - startOfDay(b)) / msPerDay);
}

// Flips any active invoice whose due date has passed into OVERDUE status.
// Safe to call often (dashboard loads, before the reminder sweep, etc).
export async function syncOverdueStatuses() {
  const today = new Date();
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] } }
  });
  const overdueIds = candidates.filter((inv) => daysBetween(today, inv.dueDate) > 0).map((i) => i.id);
  if (overdueIds.length) {
    await prisma.invoice.updateMany({ where: { id: { in: overdueIds } }, data: { status: 'OVERDUE' } });
  }
  return overdueIds.length;
}

function reminderEmailHtml(opts: {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  dueDate: Date;
  balance: string;
  link: string;
  tone: 'upcoming' | 'due' | 'overdue';
  overdueDays?: number;
}) {
  const heading =
    opts.tone === 'upcoming'
      ? `Payment reminder: Invoice ${opts.invoiceNumber} is due soon`
      : opts.tone === 'due'
        ? `Payment reminder: Invoice ${opts.invoiceNumber} is due today`
        : `Overdue: Invoice ${opts.invoiceNumber} is ${opts.overdueDays} day${opts.overdueDays === 1 ? '' : 's'} overdue`;

  return `
  <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <p>Hi ${opts.clientName || 'there'},</p>
    <p>${
      opts.tone === 'upcoming'
        ? `This is a friendly reminder that invoice <strong>${opts.invoiceNumber}</strong> from ${opts.businessName} is due on <strong>${formatDate(opts.dueDate)}</strong>.`
        : opts.tone === 'due'
          ? `This is a friendly reminder that invoice <strong>${opts.invoiceNumber}</strong> from ${opts.businessName} is due <strong>today</strong>.`
          : `Invoice <strong>${opts.invoiceNumber}</strong> from ${opts.businessName} was due on <strong>${formatDate(opts.dueDate)}</strong> and is now <strong>${opts.overdueDays} day${opts.overdueDays === 1 ? '' : 's'} overdue</strong>.`
    }</p>
    <p>Amount due: <strong>${opts.balance}</strong></p>
    <p><a href="${opts.link}" style="display:inline-block;padding:10px 18px;background:#3866f5;color:#fff;text-decoration:none;border-radius:6px;">View &amp; pay invoice</a></p>
    <p style="color:#666;font-size:13px;">If you've already paid, please ignore this message. Sent automatically by ${opts.businessName}.</p>
  </div>`;
}

export type ReminderSweepResult = {
  checked: number;
  sent: number;
  skippedNoEmail: number;
  failed: number;
};

// The core automatic-reminder logic. Looks at every unpaid, already-sent
// invoice and decides whether *today* matches one of the configured
// reminder days (N days before due, on the due date, or every N days after
// it's overdue), then emails the client if so. Each (invoice, day-offset)
// pair only ever fires once, tracked via ReminderLog.
export async function runReminderSweep(trigger: 'cron' | 'manual' = 'cron'): Promise<ReminderSweepResult> {
  await syncOverdueStatuses();
  const settings = await getSettings();
  const beforeDays = parseDayOffsets(settings.reminderBeforeDaysJson);
  const afterDays = parseDayOffsets(settings.reminderAfterDaysJson);

  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ACTIVE_STATUSES }, balanceDueCents: { gt: 0 } },
    include: { client: true, reminders: true }
  });

  const result: ReminderSweepResult = { checked: invoices.length, sent: 0, skippedNoEmail: 0, failed: 0 };
  const today = new Date();
  const mailerReady = isMailerConfigured();

  for (const invoice of invoices) {
    const diff = daysBetween(invoice.dueDate, today); // > 0 = still upcoming, 0 = due today, < 0 = overdue
    let type: 'BEFORE_DUE' | 'ON_DUE' | 'OVERDUE' | null = null;
    let offset = 0;
    let tone: 'upcoming' | 'due' | 'overdue' = 'upcoming';

    if (diff > 0 && beforeDays.includes(diff)) {
      type = 'BEFORE_DUE';
      offset = -diff;
      tone = 'upcoming';
    } else if (diff === 0 && settings.reminderOnDueDate) {
      type = 'ON_DUE';
      offset = 0;
      tone = 'due';
    } else if (diff < 0 && afterDays.includes(-diff)) {
      const overdueRemindersSoFar = invoice.reminders.filter((r) => r.type === 'OVERDUE' && r.success).length;
      if (overdueRemindersSoFar < settings.reminderMaxAfterCount) {
        type = 'OVERDUE';
        offset = -diff;
        tone = 'overdue';
      }
    }

    if (!type) continue;

    const alreadySent = invoice.reminders.some((r) => r.type === type && r.daysOffset === offset && r.success);
    if (alreadySent) continue;

    if (!invoice.client.email) {
      result.skippedNoEmail++;
      await prisma.reminderLog.create({
        data: { invoiceId: invoice.id, type, daysOffset: offset, success: false, error: 'Client has no email address' }
      });
      continue;
    }

    if (!mailerReady) {
      result.failed++;
      await prisma.reminderLog.create({
        data: { invoiceId: invoice.id, type, daysOffset: offset, success: false, error: 'SMTP not configured' }
      });
      continue;
    }

    const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/p/invoice/${invoice.publicId}`;
    const html = reminderEmailHtml({
      clientName: invoice.client.name,
      businessName: settings.businessName,
      invoiceNumber: invoice.number,
      dueDate: invoice.dueDate,
      balance: formatMoney(invoice.balanceDueCents, invoice.currency),
      link,
      tone,
      overdueDays: type === 'OVERDUE' ? offset : undefined
    });

    try {
      await sendMail({
        to: invoice.client.email,
        subject:
          tone === 'overdue'
            ? `Overdue: Invoice ${invoice.number} — ${formatMoney(invoice.balanceDueCents, invoice.currency)} due`
            : `Payment reminder: Invoice ${invoice.number} ${tone === 'due' ? 'is due today' : `due ${formatDate(invoice.dueDate)}`}`,
        html
      });
      await prisma.reminderLog.create({ data: { invoiceId: invoice.id, type, daysOffset: offset, success: true } });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } }
      });
      result.sent++;
    } catch (err) {
      result.failed++;
      await prisma.reminderLog.create({
        data: {
          invoiceId: invoice.id,
          type,
          daysOffset: offset,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      });
    }
  }

  return result;
}

// Sends an immediate, on-demand reminder regardless of the day-offset
// schedule — used by the "Send reminder now" button on an invoice.
export async function sendManualReminder(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { client: true }
  });
  if (!invoice.client.email) throw new Error('This client has no email address on file.');

  const settings = await getSettings();
  const diff = daysBetween(invoice.dueDate, new Date());
  const tone: 'upcoming' | 'due' | 'overdue' = diff > 0 ? 'upcoming' : diff === 0 ? 'due' : 'overdue';
  const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/p/invoice/${invoice.publicId}`;

  const html = reminderEmailHtml({
    clientName: invoice.client.name,
    businessName: settings.businessName,
    invoiceNumber: invoice.number,
    dueDate: invoice.dueDate,
    balance: formatMoney(invoice.balanceDueCents, invoice.currency),
    link,
    tone,
    overdueDays: tone === 'overdue' ? -diff : undefined
  });

  try {
    await sendMail({
      to: invoice.client.email,
      subject: `Payment reminder: Invoice ${invoice.number}`,
      html
    });
  } catch (err) {
    await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        type: 'MANUAL',
        daysOffset: diff,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    });
    throw err;
  }

  await prisma.reminderLog.create({
    data: { invoiceId: invoice.id, type: 'MANUAL', daysOffset: diff, success: true }
  });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } }
  });
}
