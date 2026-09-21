import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles, statusColors } from './styles';
import { splitDescription } from './text';
import { formatMoney, formatDate } from '../money';
import { amountInWords } from '../words';
import type { BusinessInfo } from './InvoiceDocument';

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

export type QuotationPdfData = {
  number: string;
  status: string;
  issueDate: Date | string;
  expiryDate?: Date | string | null;
  currency: string;
  discountType: string;
  discountValue: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes?: string | null;
  terms?: string | null;
  client: Client;
  items: LineItem[];
};

function TermsBlock({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <View style={styles.termsList}>
      {lines.map((line, i) => {
        const isBullet = /^[•\-\*]/.test(line);
        const cleanLine = line.replace(/^([•\-\*]|\d+[\.\)])\s*/, '');
        return (
          <View style={styles.termsLine} key={i}>
            <Text style={styles.termsIndex}>{isBullet ? '•' : `${i + 1}.`}</Text>
            <Text style={styles.termsText}>{cleanLine || line}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function QuotationDocument({ quotation, business }: { quotation: QuotationPdfData; business: BusinessInfo }) {
  const badge = statusColors[quotation.status] ?? statusColors.DRAFT;

  return (
    <Document title={`Quotation ${quotation.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.docTitle}>Quotation</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Quotation No</Text>
              <Text style={styles.metaValue}>{quotation.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Quotation Date</Text>
              <Text style={styles.metaValue}>{formatDate(quotation.issueDate)}</Text>
            </View>
            {quotation.expiryDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Valid Till</Text>
                <Text style={styles.metaValue}>{formatDate(quotation.expiryDate)}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {business.logoDataUrl ? (
              <Image src={business.logoDataUrl} style={styles.logo} />
            ) : (
              <Text style={styles.businessNameFallback}>{business.businessName}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: badge.bg, color: badge.color }]}>
              <Text>{quotation.status.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panelRow}>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Quotation From</Text>
            <Text style={styles.panelName}>{business.businessName}</Text>
            {business.address ? <Text style={styles.panelLine}>{business.address}</Text> : null}
            {business.email ? <Text style={styles.panelLine}>{business.email}</Text> : null}
            {business.phone ? <Text style={styles.panelLine}>{business.phone}</Text> : null}
            {business.gstin ? <Text style={styles.panelLine}>GSTIN: {business.gstin}</Text> : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Quotation For</Text>
            <Text style={styles.panelName}>{quotation.client.name}</Text>
            {quotation.client.billingAddress ? <Text style={styles.panelLine}>{quotation.client.billingAddress}</Text> : null}
            {quotation.client.email ? <Text style={styles.panelLine}>{quotation.client.email}</Text> : null}
            {quotation.client.phone ? <Text style={styles.panelLine}>{quotation.client.phone}</Text> : null}
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
          {quotation.items.map((item, i) => {
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
                <Text style={styles.colRate}>{formatMoney(item.rateCents, quotation.currency)}</Text>
                <Text style={styles.colTax}>{item.taxPercent}%</Text>
                <Text style={styles.colAmount}>{formatMoney(item.lineTotalCents, quotation.currency)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.wordsBlock}>
            <Text style={styles.wordsLabel}>Total in words</Text>
            <Text style={styles.wordsText}>{amountInWords(quotation.totalCents, quotation.currency)}</Text>
          </View>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatMoney(quotation.subtotalCents, quotation.currency)}</Text>
            </View>
            {quotation.discountCents > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount {quotation.discountType === 'PERCENT' ? `(${quotation.discountValue}%)` : ''}
                </Text>
                <Text style={styles.totalsValue}>-{formatMoney(quotation.discountCents, quotation.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatMoney(quotation.taxCents, quotation.currency)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text>Total</Text>
              <Text>{formatMoney(quotation.totalCents, quotation.currency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerSection}>
          <View style={styles.notesBox}>
            {quotation.notes ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.footerLabel}>Notes</Text>
                <Text style={styles.footerText}>{quotation.notes}</Text>
              </View>
            ) : null}
            {quotation.terms ? (
              <View>
                <Text style={styles.footerLabel}>Terms &amp; Conditions</Text>
                <TermsBlock text={quotation.terms} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.pageFooter} fixed>
          <Text>This is an electronically generated document, no signature is required.</Text>
          <Text render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : '')} />
        </View>
      </Page>
    </Document>
  );
}
