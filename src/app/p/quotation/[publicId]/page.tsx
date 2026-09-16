import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';
import { formatMoney, formatDate } from '@/lib/money';
import { amountInWords } from '@/lib/words';
import { StatusBadge } from '@/components/StatusBadge';
import { ItemDescription } from '@/components/ItemDescription';
import { QuotationResponse } from '@/components/QuotationResponse';

export const dynamic = 'force-dynamic';

export default async function PublicQuotationPage({ params }: { params: { publicId: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { publicId: params.publicId },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } }
  });
  if (!quotation || quotation.status === 'DRAFT') notFound();

  if (!quotation.viewedAt) {
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { viewedAt: new Date(), status: quotation.status === 'SENT' ? 'VIEWED' : quotation.status }
    });
  }

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-brand-50/40 py-10 px-4">
      <div className="max-w-3xl mx-auto card overflow-hidden">
        <div className="p-8 sm:p-10">
          <div className="flex justify-between items-start mb-8 gap-6">
            <div>
              <h1 className="text-3xl font-bold text-brand-800 mb-3">Quotation</h1>
              <dl className="text-sm space-y-1">
                <div className="flex gap-3">
                  <dt className="w-28 text-gray-500">Quotation No</dt>
                  <dd className="font-semibold text-brand-800">{quotation.number}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 text-gray-500">Quotation Date</dt>
                  <dd className="font-semibold text-brand-800">{formatDate(quotation.issueDate)}</dd>
                </div>
                {quotation.expiryDate ? (
                  <div className="flex gap-3">
                    <dt className="w-28 text-gray-500">Valid Till</dt>
                    <dd className="font-semibold text-brand-800">{formatDate(quotation.expiryDate)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="flex flex-col items-end shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logoDataUrl || DEFAULT_LOGO_PATH} alt={settings.businessName} className="h-16 object-contain mb-2" />
              <StatusBadge status={quotation.status} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="rounded-lg border border-gold-200 bg-gold-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Quotation From</p>
              <p className="font-semibold text-brand-800">{settings.businessName}</p>
              {settings.address ? <p className="text-sm text-gray-600 whitespace-pre-line">{settings.address}</p> : null}
              {settings.email ? <p className="text-sm text-gray-600">{settings.email}</p> : null}
              {settings.phone ? <p className="text-sm text-gray-600">{settings.phone}</p> : null}
            </div>
            <div className="rounded-lg border border-gold-200 bg-gold-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Quotation For</p>
              <p className="font-semibold text-brand-800">{quotation.client.name}</p>
              {quotation.client.billingAddress ? (
                <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.client.billingAddress}</p>
              ) : null}
              {quotation.client.email ? <p className="text-sm text-gray-600">{quotation.client.email}</p> : null}
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
                {quotation.items.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 1 ? 'bg-gold-50/50' : ''}>
                    <td className="pl-4 py-3 align-top text-gray-400">{i + 1}.</td>
                    <td className="py-3 pr-3 align-top">
                      <ItemDescription description={item.description} />
                    </td>
                    <td className="py-3 text-right align-top whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 text-right align-top whitespace-nowrap">{formatMoney(item.rateCents, quotation.currency)}</td>
                    <td className="py-3 pr-4 text-right align-top font-semibold whitespace-nowrap">
                      {formatMoney(item.lineTotalCents, quotation.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between gap-6 mb-2">
            <div className="text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Total in words</p>
              <p className="font-semibold text-brand-800">{amountInWords(quotation.totalCents, quotation.currency)}</p>
            </div>
            <div className="w-full sm:w-64 space-y-1.5 text-sm shrink-0">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatMoney(quotation.subtotalCents, quotation.currency)}</span>
              </div>
              {quotation.discountCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span>-{formatMoney(quotation.discountCents, quotation.currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span>{formatMoney(quotation.taxCents, quotation.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t-2 border-brand-800 pt-1.5">
                <span>Total</span>
                <span>{formatMoney(quotation.totalCents, quotation.currency)}</span>
              </div>
            </div>
          </div>

          {(quotation.notes || quotation.terms) && (
            <div className="text-sm space-y-3 max-w-sm border-t border-gray-100 mt-6 pt-6">
              {quotation.notes ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Notes</p>
                  <p className="whitespace-pre-line text-gray-600">{quotation.notes}</p>
                </div>
              ) : null}
              {quotation.terms ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Terms</p>
                  <p className="whitespace-pre-line text-gray-600">{quotation.terms}</p>
                </div>
              ) : null}
            </div>
          )}

          {quotation.status === 'ACCEPTED' && (
            <p className="mt-6 text-sm font-medium text-emerald-700">✓ You accepted this quotation. We&apos;ll be in touch shortly.</p>
          )}
          {quotation.status === 'REJECTED' && <p className="mt-6 text-sm font-medium text-red-700">You declined this quotation.</p>}

          <QuotationResponse publicId={quotation.publicId} status={quotation.status} />
        </div>

        <div className="bg-gray-50 border-t border-gray-100 px-8 sm:px-10 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">This is an electronically generated document, no signature is required.</p>
          <a href={`/api/public/quotations/${quotation.publicId}/pdf`} className="btn-secondary">
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}
