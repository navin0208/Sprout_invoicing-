import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    let max = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (v !== null && v !== undefined) {
        const str = typeof v === 'object' && 'text' in v ? String(v.text) : String(v);
        if (str.length > max) max = str.length;
      }
    });
    column.width = Math.min(Math.max(max + 4, 14), 45);
  });
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'all';
  const settings = await getSettings();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.businessName || 'Invoicing App';
  workbook.created = new Date();

  // 1. Fetch data
  const [invoices, quotations, clients, items, payments] = await Promise.all([
    prisma.invoice.findMany({
      include: { client: true, payments: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.quotation.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.client.findMany({
      include: { invoices: true },
      orderBy: { name: 'asc' }
    }),
    prisma.item.findMany({
      orderBy: { name: 'asc' }
    }),
    prisma.payment.findMany({
      include: { invoice: { include: { client: true } } },
      orderBy: { date: 'desc' }
    })
  ]);

  // Format date helper
  const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');

  // SHEET: SUMMARY (only if type === 'all')
  if (type === 'all') {
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Business & Financial Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 30 }
    ];

    const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalCents, 0) / 100;
    const totalCollected = invoices.reduce((sum, inv) => sum + inv.amountPaidCents, 0) / 100;
    const totalBalance = invoices.reduce((sum, inv) => sum + inv.balanceDueCents, 0) / 100;
    const overdueInvoices = invoices.filter((inv) => inv.status === 'OVERDUE');
    const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.balanceDueCents, 0) / 100;

    summarySheet.addRows([
      { metric: 'Organization Name', value: settings.businessName },
      { metric: 'Default Currency', value: settings.defaultCurrency },
      { metric: 'Report Generated At', value: new Date().toLocaleString() },
      { metric: 'Total Invoices Count', value: invoices.length },
      { metric: 'Total Amount Billed', value: totalBilled },
      { metric: 'Total Payments Received', value: totalCollected },
      { metric: 'Total Outstanding Receivables', value: totalBalance },
      { metric: 'Total Overdue Amount', value: overdueTotal },
      { metric: 'Overdue Invoices Count', value: overdueInvoices.length },
      { metric: 'Total Quotations Count', value: quotations.length },
      { metric: 'Total Registered Clients', value: clients.length },
      { metric: 'Total Catalog Products/Services', value: items.length }
    ]);

    styleHeaderRow(summarySheet);
    autoFitColumns(summarySheet);
  }

  // SHEET: INVOICES
  if (type === 'all' || type === 'invoices') {
    const invSheet = workbook.addWorksheet('Invoices');
    invSheet.columns = [
      { header: 'Invoice #', key: 'number' },
      { header: 'Client Name', key: 'clientName' },
      { header: 'Client Email', key: 'clientEmail' },
      { header: 'Status', key: 'status' },
      { header: 'Issue Date', key: 'issueDate' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Currency', key: 'currency' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'Tax', key: 'tax' },
      { header: 'Total', key: 'total' },
      { header: 'Paid', key: 'paid' },
      { header: 'Balance Due', key: 'balance' },
      { header: 'Created Date', key: 'createdAt' }
    ];

    invoices.forEach((inv) => {
      invSheet.addRow({
        number: inv.number,
        clientName: inv.client.name,
        clientEmail: inv.client.email || '',
        status: inv.status,
        issueDate: fmtDate(inv.issueDate),
        dueDate: fmtDate(inv.dueDate),
        currency: inv.currency,
        subtotal: inv.subtotalCents / 100,
        tax: inv.taxCents / 100,
        total: inv.totalCents / 100,
        paid: inv.amountPaidCents / 100,
        balance: inv.balanceDueCents / 100,
        createdAt: fmtDate(inv.createdAt)
      });
    });

    styleHeaderRow(invSheet);
    autoFitColumns(invSheet);
  }

  // SHEET: PAYMENTS
  if (type === 'all' || type === 'payments') {
    const paySheet = workbook.addWorksheet('Payments');
    paySheet.columns = [
      { header: 'Payment Date', key: 'date' },
      { header: 'Invoice #', key: 'invoiceNumber' },
      { header: 'Client Name', key: 'clientName' },
      { header: 'Amount', key: 'amount' },
      { header: 'Method', key: 'method' },
      { header: 'Note', key: 'note' }
    ];

    payments.forEach((p) => {
      paySheet.addRow({
        date: fmtDate(p.date),
        invoiceNumber: p.invoice.number,
        clientName: p.invoice.client.name,
        amount: p.amountCents / 100,
        method: p.method,
        note: p.note || ''
      });
    });

    styleHeaderRow(paySheet);
    autoFitColumns(paySheet);
  }

  // SHEET: QUOTATIONS
  if (type === 'all' || type === 'quotations') {
    const quoteSheet = workbook.addWorksheet('Quotations');
    quoteSheet.columns = [
      { header: 'Quotation #', key: 'number' },
      { header: 'Client Name', key: 'clientName' },
      { header: 'Status', key: 'status' },
      { header: 'Issue Date', key: 'issueDate' },
      { header: 'Expiry Date', key: 'expiryDate' },
      { header: 'Currency', key: 'currency' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'Tax', key: 'tax' },
      { header: 'Total', key: 'total' },
      { header: 'Client Note', key: 'clientNote' }
    ];

    quotations.forEach((q) => {
      quoteSheet.addRow({
        number: q.number,
        clientName: q.client.name,
        status: q.status,
        issueDate: fmtDate(q.issueDate),
        expiryDate: fmtDate(q.expiryDate),
        currency: q.currency,
        subtotal: q.subtotalCents / 100,
        tax: q.taxCents / 100,
        total: q.totalCents / 100,
        clientNote: q.clientNote || ''
      });
    });

    styleHeaderRow(quoteSheet);
    autoFitColumns(quoteSheet);
  }

  // SHEET: CLIENTS
  if (type === 'all' || type === 'clients') {
    const clientSheet = workbook.addWorksheet('Clients');
    clientSheet.columns = [
      { header: 'Client Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'GSTIN', key: 'gstin' },
      { header: 'Billing Address', key: 'billingAddress' },
      { header: 'Total Invoices', key: 'invoicesCount' },
      { header: 'Total Billed', key: 'totalBilled' },
      { header: 'Total Outstanding', key: 'totalOutstanding' }
    ];

    clients.forEach((c) => {
      const billed = c.invoices.reduce((acc, inv) => acc + inv.totalCents, 0) / 100;
      const balance = c.invoices.reduce((acc, inv) => acc + inv.balanceDueCents, 0) / 100;

      clientSheet.addRow({
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        gstin: c.gstin || '',
        billingAddress: c.billingAddress || '',
        invoicesCount: c.invoices.length,
        totalBilled: billed,
        totalOutstanding: balance
      });
    });

    styleHeaderRow(clientSheet);
    autoFitColumns(clientSheet);
  }

  // SHEET: ITEMS
  if (type === 'all' || type === 'items') {
    const itemSheet = workbook.addWorksheet('Catalog Items');
    itemSheet.columns = [
      { header: 'Item Name', key: 'name' },
      { header: 'Description', key: 'description' },
      { header: 'Unit', key: 'unit' },
      { header: 'Rate', key: 'rate' },
      { header: 'Default Tax %', key: 'taxPercent' }
    ];

    items.forEach((item) => {
      itemSheet.addRow({
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        rate: item.rateCents / 100,
        taxPercent: item.taxPercent ?? 0
      });
    });

    styleHeaderRow(itemSheet);
    autoFitColumns(itemSheet);
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const fileDate = new Date().toISOString().slice(0, 10);
  const filename =
    type === 'all'
      ? `organization_report_${fileDate}.xlsx`
      : `${type}_report_${fileDate}.xlsx`;

  return new NextResponse(rawBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
