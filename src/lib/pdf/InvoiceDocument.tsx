import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles, statusColors } from './styles';
import { splitDescription } from './text';
import { formatMoney, formatDate } from '../money';
import { amountInWords } from '../words';

type Client = {
  name: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  gstin?: string | null;
};

type LineItem = {
  description: string;
  quantity: number;
  unit: string;
  rateCents: number;
  taxPercent: number;
  lineTotalCents: number;
};

export type InvoicePdfData = {
  number: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string;
  currency: string;
  discountType: string;
  discountValue: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  notes?: string | null;
  terms?: string | null;
  client: Client;
  items: LineItem[];
};

export type BusinessInfo = {
  businessName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  logoDataUrl?: string | null;
  bankDetails?: string | null;
};

function TermsBlock({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <View style={styles.termsList}>
      {lines.map((line, i) => (
        <View style={styles.termsLine} key={i}>
          <Text style={styles.termsIndex}>{i + 1}.</Text>
          <Text style={styles.termsText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function InvoiceDocument({
  invoice,
  business,
  qrDataUrl
}: {
  invoice: InvoicePdfData;
  business: BusinessInfo;
  qrDataUrl?: string | null;
}) {
  const badge = statusColors[invoice.status] ?? statusColors.DRAFT;

  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.docTitle}>Invoice</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice No</Text>
              <Text style={styles.metaValue}>{invoice.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {business.logoDataUrl ? (
              <Image src={business.logoDataUrl} style={styles.logo} />
            ) : (
              <Text style={styles.businessNameFallback}>{business.businessName}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: badge.bg, color: badge.color }]}>
              <Text>{invoice.status.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panelRow}>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Billed By</Text>
            <Text style={styles.panelName}>{business.businessName}</Text>
            {business.address ? <Text style={styles.panelLine}>{business.address}</Text> : null}
            {business.email ? <Text style={styles.panelLine}>{business.email}</Text> : null}
            {business.phone ? <Text style={styles.panelLine}>{business.phone}</Text> : null}
            {business.gstin ? <Text style={styles.panelLine}>GSTIN: {business.gstin}</Text> : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Billed To</Text>
            <Text style={styles.panelName}>{invoice.client.name}</Text>
            {invoice.client.billingAddress ? <Text style={styles.panelLine}>{invoice.client.billingAddress}</Text> : null}
            {invoice.client.email ? <Text style={styles.panelLine}>{invoice.client.email}</Text> : null}
            {invoice.client.phone ? <Text style={styles.panelLine}>{invoice.client.phone}</Text> : null}
            {invoice.client.gstin ? <Text style={styles.panelLine}>GSTIN: {invoice.client.gstin}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colNum]}> </Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Item</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.colTax]}>Tax</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          {invoice.items.map((item, i) => {
            const { title, bullets } = splitDescription(item.description);
            return (
              <View style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} key={i} wrap={false}>
                <Text style={styles.colNum}>{i + 1}.</Text>
                <View style={styles.colDesc}>
                  <Text style={styles.itemName}>{title}</Text>
                  {bullets.map((b, bi) => (
                    <View style={styles.itemBulletRow} key={bi}>
                      <Text style={styles.itemBulletDot}>•</Text>
                      <Text style={styles.itemBulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.colQty}>
                  {item.quantity} {item.unit}
                </Text>
                <Text style={styles.colRate}>{formatMoney(item.rateCents, invoice.currency)}</Text>
                <Text style={styles.colTax}>{item.taxPercent}%</Text>
                <Text style={styles.colAmount}>{formatMoney(item.lineTotalCents, invoice.currency)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.wordsBlock}>
            <Text style={styles.wordsLabel}>Total in words</Text>
            <Text style={styles.wordsText}>{amountInWords(invoice.totalCents, invoice.currency)}</Text>
          </View>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatMoney(invoice.subtotalCents, invoice.currency)}</Text>
            </View>
            {invoice.discountCents > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount {invoice.discountType === 'PERCENT' ? `(${invoice.discountValue}%)` : ''}
                </Text>
                <Text style={styles.totalsValue}>-{formatMoney(invoice.discountCents, invoice.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatMoney(invoice.taxCents, invoice.currency)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text>Total</Text>
              <Text>{formatMoney(invoice.totalCents, invoice.currency)}</Text>
            </View>
            {invoice.amountPaidCents > 0 ? (
              <View style={[styles.totalsRow, { marginTop: 6 }]}>
                <Text style={styles.totalsLabel}>Paid</Text>
                <Text style={styles.totalsValue}>{formatMoney(invoice.amountPaidCents, invoice.currency)}</Text>
              </View>
            ) : null}
            {invoice.balanceDueCents > 0 ? (
              <View style={styles.balanceRow}>
                <Text>Balance Due</Text>
                <Text>{formatMoney(invoice.balanceDueCents, invoice.currency)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footerSection}>
          <View style={styles.notesBox}>
            {invoice.notes ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.footerLabel}>Notes</Text>
                <Text style={styles.footerText}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.footerLabel}>Terms &amp; Conditions</Text>
                <TermsBlock text={invoice.terms} />
              </View>
            ) : null}
            {business.bankDetails ? (
              <View>
                <Text style={styles.footerLabel}>Bank Details</Text>
                <Text style={styles.footerText}>{business.bankDetails}</Text>
              </View>
            ) : null}
          </View>
          {qrDataUrl && invoice.balanceDueCents > 0 ? (
            <View style={styles.qrBox}>
              <Image src={qrDataUrl} style={styles.qrImage} />
              <Text style={styles.qrCaption}>Scan to pay via UPI</Text>
              <Text style={styles.qrAmount}>{formatMoney(invoice.balanceDueCents, invoice.currency)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.pageFooter} fixed>
          <Text>This is an electronically generated document, no signature is required.</Text>
          <Text render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : '')} />
        </View>
      </Page>
    </Document>
  );
}
