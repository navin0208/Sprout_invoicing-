import { Font, StyleSheet } from '@react-pdf/renderer';
import path from 'path';

// The base-14 PDF fonts (Helvetica etc) have no glyph for ₹ (U+20B9) — it
// silently renders as a superscript "1" otherwise. Noto Sans does, so it's
// bundled and registered as the document font instead. Registering twice
// (guarded) is safe/cheap — Font.register is idempotent per family name,
// and every PDF route module gets its own fresh import of this file.
Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: path.join(process.cwd(), 'src/lib/pdf/fonts/NotoSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'src/lib/pdf/fonts/NotoSans-Bold.ttf'), fontWeight: 700 }
  ]
});

// Sprout Media brand — sampled directly from the logo file.
export const INK = '#28232a';
export const INK_SOFT = '#5b5560';
export const GOLD = '#fece00';
export const GOLD_TINT = '#fffaea';
export const GOLD_BORDER = '#f6e7b0';

export const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontSize: 9.5, fontFamily: 'Noto Sans', color: INK },

  // Header: big title + meta rows on the left, logo on the right.
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  docTitle: { fontSize: 26, fontWeight: 700, color: INK, marginBottom: 10 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 85, color: INK_SOFT },
  metaValue: { fontWeight: 700, color: INK },
  logo: { width: 118, height: 70, objectFit: 'contain' },
  businessNameFallback: { fontSize: 13, fontWeight: 700, textAlign: 'right' },

  badge: {
    alignSelf: 'flex-end',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 3,
    fontSize: 8.5,
    fontWeight: 700,
    marginTop: 8
  },

  // "Billed By / Billed To" panels.
  panelRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  panel: { flex: 1, backgroundColor: GOLD_TINT, borderRadius: 6, padding: 12, border: `1 solid ${GOLD_BORDER}` },
  panelLabel: { fontSize: 8.5, fontWeight: 700, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  panelName: { fontSize: 11, fontWeight: 700, marginBottom: 2, color: INK },
  panelLine: { color: INK_SOFT, marginBottom: 1, lineHeight: 1.35 },

  supplyRow: { flexDirection: 'row', gap: 24, marginBottom: 14 },
  supplyItem: { fontSize: 9 },
  supplyLabel: { fontWeight: 700, color: INK },

  // Item table.
  table: { display: 'flex', width: '100%', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: INK,
    paddingVertical: 7,
    paddingHorizontal: 8
  },
  tableHeaderCell: { color: '#ffffff', fontWeight: 700, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottom: '1 solid #efe9d6'
  },
  tableRowAlt: { backgroundColor: GOLD_TINT },
  colNum: { width: 20, color: INK_SOFT },
  colDesc: { flex: 3.4 },
  colQty: { flex: 0.9, textAlign: 'right' },
  colRate: { flex: 1.2, textAlign: 'right' },
  colTax: { flex: 0.8, textAlign: 'right' },
  colAmount: { flex: 1.3, textAlign: 'right', fontWeight: 700 },
  itemName: { fontWeight: 700, color: INK },
  itemBulletRow: { flexDirection: 'row', marginTop: 3, paddingRight: 10 },
  itemBulletDot: { width: 8, color: INK_SOFT },
  itemBulletText: { flex: 1, color: INK_SOFT, fontSize: 8.8, lineHeight: 1.4 },

  // Totals + amount-in-words footer of the table section.
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 },
  wordsBlock: { flex: 1, marginRight: 20 },
  wordsLabel: { fontSize: 8.5, fontWeight: 700, color: INK_SOFT, textTransform: 'uppercase', marginBottom: 3 },
  wordsText: { fontSize: 9.5, fontWeight: 700, color: INK },
  totalsBlock: { width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalsLabel: { color: INK_SOFT },
  totalsValue: { color: INK },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1.5 solid ${INK}`,
    marginTop: 5,
    paddingTop: 6,
    fontWeight: 700,
    fontSize: 12
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fdeceb',
    borderRadius: 4,
    fontWeight: 700,
    color: '#c0392b'
  },

  // Notes / terms / bank details.
  footerSection: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between', gap: 20 },
  notesBox: { flex: 1 },
  footerLabel: { fontSize: 8.5, fontWeight: 700, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  footerText: { color: INK_SOFT, marginBottom: 2, lineHeight: 1.4 },
  termsList: { marginTop: 2 },
  termsLine: { flexDirection: 'row', marginBottom: 3 },
  termsIndex: { width: 14, color: INK_SOFT },
  termsText: { flex: 1, color: INK_SOFT, lineHeight: 1.4 },

  qrBox: { width: 130, alignItems: 'center' },
  qrImage: { width: 104, height: 104, marginBottom: 5, border: `1 solid ${GOLD_BORDER}`, borderRadius: 4, padding: 4 },
  qrCaption: { color: INK_SOFT, fontSize: 8 },
  qrAmount: { fontWeight: 700, fontSize: 10.5, marginTop: 1 },

  pageFooter: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#9a9498',
    borderTop: '1 solid #eeeeee',
    paddingTop: 8
  }
});

export const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: '#eeeeee', color: '#555555' },
  SENT: { bg: '#eef0f2', color: '#3a3540' },
  VIEWED: { bg: '#eef0f2', color: '#3a3540' },
  PARTIALLY_PAID: { bg: '#fff6d9', color: '#8a6300' },
  PAID: { bg: '#e3f8ea', color: '#1e8a4c' },
  OVERDUE: { bg: '#fde9e7', color: '#c0392b' },
  CANCELLED: { bg: '#f0f0f0', color: '#888888' },
  ACCEPTED: { bg: '#e3f8ea', color: '#1e8a4c' },
  REJECTED: { bg: '#fde9e7', color: '#c0392b' },
  EXPIRED: { bg: '#f0f0f0', color: '#888888' },
  CONVERTED: { bg: '#eef0f2', color: '#3a3540' }
};
