import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [settings, clients, items, quotations, invoices, payments, reminderLogs] =
    await Promise.all([
      getSettings(),
      prisma.client.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.item.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.quotation.findMany({
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.invoice.findMany({
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          payments: { orderBy: { date: 'desc' } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.findMany({ orderBy: { date: 'desc' } }),
      prisma.reminderLog.findMany({ orderBy: { sentAt: 'desc' }, take: 200 })
    ]);

  const backupData = {
    exportedAt: new Date().toISOString(),
    organization: settings.businessName,
    settings,
    clients,
    items,
    quotations,
    invoices,
    payments,
    reminderLogs
  };

  const fileDate = new Date().toISOString().slice(0, 10);
  const filename = `organization_backup_${fileDate}.json`;

  return new NextResponse(JSON.stringify(backupData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
