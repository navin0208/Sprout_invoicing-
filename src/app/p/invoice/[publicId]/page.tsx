import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';
import { formatMoney, formatDate, fromCents } from '@/lib/money';
import { amountInWords } from '@/lib/words';
import { buildUpiQrDataUrl } from '@/lib/upi';
import { StatusBadge } from '@/components/StatusBadge';
import { ItemDescription } from '@/components/ItemDescription';

export const dynamic = 'force-dynamic';

export default async function PublicInvoicePage({ params }: { params: { publicId: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { publicId: params.publicId },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } }
  });
  if (!invoice || invoice.status === 'DRAFT') notFound();

  if (!invoice.viewedAt) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { viewedAt: new Date(), status: invoice.status === 'SENT' ? 'VIEWED' : invoice.status }
    });
  }

  const settings = await getSettings();
  const qrDataUrl =
    settings.upiId && invoice.balanceDueCents > 0
      ? await buildUpiQrDataUrl({
          upiId: settings.upiId,
          payeeName: settings.businessName,
          amount: fromCents(invoice.balanceDueCents),
          note: `Invoice ${invoice.number}`
        })
      : null;

  return (
    <div className="min-h-screen bg-brand-50/40 py-10 px-4">
      <div className="max-w-3xl mx-auto card overflow-hidden">
        <div className="p-8 sm:p-10">
          <div className="flex justify-between items-start mb-8 gap-6">
            <div>
              <h1 className="text-3xl font-bold text-brand-800 mb-3">Invoice</h1>
              <dl className="text-sm space-y-1">
                <div className="flex gap-3">
                  <dt className="w-28 text-gray-500">Invoice No</dt>
                  <dd className="font-semibold text-brand-800">{invoice.number}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 text-gray-500">Invoice Date</dt>
                  <dd className="font-semibold text-brand-800">{formatDate(invoice.issueDate)}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 text-gray-500">Due Date</dt>
                  <dd className="font-semibold text-brand-800">{formatDate(invoice.dueDate)}</dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col items-end shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logoDataUrl || DEFAULT_LOGO_PATH} alt={settings.businessName} className="h-16 object-contain mb-2" />
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="rounded-lg border border-gold-200 bg-gold-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Billed By</p>
              <p className="font-semibold text-brand-800">{settings.businessName}</p>
              {settings.address ? <p className="text-sm text-gray-600 whitespace-pre-line">{settings.address}</p> : null}
              {settings.email ? <p className="text-sm text-gray-600">{settings.email}</p> : null}
              {settings.gstin ? <p className="text-sm text-gray-600">GSTIN: {settings.gstin}</p> : null}
            </div>
            <div className="rounded-lg border border-gold-200 bg-gold-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Billed To</p>
              <p className="font-semibold text-brand-800">{invoice.client.name}</p>
              {invoice.client.billingAddress ? (
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.client.billingAddress}</p>
              ) : null}
              {invoice.client.email ? <p className="text-sm text-gray-600">{invoice.client.email}</p> : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 mb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-800 text-white text-xs uppercase tracking-wide">
                  <th className="w-8 py-2.5 pl-4"></th>
                  <th className="text-left py-2.5">Item</th>
                  <th className="text-right py-2.5">Qty</th>
                  <th className="text-right py-2.5">Rate</th>
                  <th className="text-right py-2.5 pr-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 1 ? 'bg-gold-50/50' : ''}>
                    <td className="pl-4 py-3 align-top text-gray-400">{i + 1}.</td>
                    <td className="py-3 pr-3 align-top">
                      <ItemDescription description={item.description} />
                    </td>
                    <td className="py-3 text-right align-top whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 text-right align-top whitespace-nowrap">{formatMoney(item.rateCents, invoice.currency)}</td>
                    <td className="py-3 pr-4 text-right align-top font-semibold whitespace-nowrap">
                      {formatMoney(item.lineTotalCents, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between gap-6 mb-2">
            <div className="text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Total in words</p>
              <p className="font-semibold text-brand-800">{amountInWords(invoice.totalCents, invoice.currency)}</p>
            </div>
            <div className="w-full sm:w-64 space-y-1.5 text-sm shrink-0">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatMoney(invoice.subtotalCents, invoice.currency)}</span>
              </div>
              {invoice.discountCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span>-{formatMoney(invoice.discountCents, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span>{formatMoney(invoice.taxCents, invoice.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t-2 border-brand-800 pt-1.5">
                <span>Total</span>
                <span>{formatMoney(invoice.totalCents, invoice.currency)}</span>
              </div>
              {invoice.amountPaidCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid</span>
                  <span>{formatMoney(invoice.amountPaidCents, invoice.currency)}</span>
                </div>
              )}
              {invoice.balanceDueCents > 0 && (
                <div className="flex justify-between font-bold text-red-600 bg-red-50 rounded px-2.5 py-1.5">
                  <span>Balance Due</span>
                  <span>{formatMoney(invoice.balanceDueCents, invoice.currency)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between flex-wrap gap-6 border-t border-gray-100 mt-6 pt-6">
            <div className="text-sm space-y-3 max-w-sm">
              {invoice.notes ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Notes</p>
                  <p className="whitespace-pre-line text-gray-600">{invoice.notes}</p>
                </div>
              ) : null}
              {invoice.terms ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Terms</p>
                  <p className="whitespace-pre-line text-gray-600">{invoice.terms}</p>
                </div>
              ) : null}
              {settings.bankDetails ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Bank Details</p>
                  <p className="whitespace-pre-line text-gray-600">{settings.bankDetails}</p>
                </div>
              ) : null}
            </div>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <div className="text-center shrink-0">
                <img src={qrDataUrl} alt="UPI QR code" className="w-28 h-28 mx-auto mb-1 rounded border border-gold-200 p-1" />
                <p className="text-xs text-gray-500">Scan to pay via UPI</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-gray-50 border-t border-gray-100 px-8 sm:px-10 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">This is an electronically generated document, no signature is required.</p>
          <a href={`/api/public/invoices/${invoice.publicId}/pdf`} className="btn-primary">
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}
