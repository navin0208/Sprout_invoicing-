// Shared line-item / totals math for invoices and quotations. Used both by
// the client-side form (live preview) and the API routes (source of truth
// when saving), so the two never disagree.

export type LineInput = {
  quantity: number;
  rateCents: number;
  taxPercent: number;
};

export type LineResult = LineInput & {
  lineSubtotalCents: number;
  lineTaxCents: number;
  lineTotalCents: number;
};

export function computeLine(line: LineInput): LineResult {
  const subtotal = Math.round(line.quantity * line.rateCents);
  const tax = Math.round((subtotal * (line.taxPercent || 0)) / 100);
  return {
    ...line,
    lineSubtotalCents: subtotal,
    lineTaxCents: tax,
    lineTotalCents: subtotal + tax
  };
}

export type DocumentTotals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export function computeDocumentTotals(
  lines: LineInput[],
  discountType: 'NONE' | 'PERCENT' | 'FLAT',
  discountValue: number
): DocumentTotals {
  const computed = lines.map(computeLine);
  const subtotalCents = computed.reduce((s, l) => s + l.lineSubtotalCents, 0);

  let discountCents = 0;
  if (discountType === 'PERCENT') {
    discountCents = Math.round((subtotalCents * (discountValue || 0)) / 100);
  } else if (discountType === 'FLAT') {
    discountCents = Math.round(discountValue || 0);
  }
  discountCents = Math.min(discountCents, subtotalCents);

  // Apply the discount proportionally before tax so line-level tax rates
  // stay meaningful, then sum tax on the discounted base.
  const discountRatio = subtotalCents > 0 ? discountCents / subtotalCents : 0;
  const taxCents = computed.reduce((s, l) => {
    const discountedLineSubtotal = l.lineSubtotalCents * (1 - discountRatio);
    return s + Math.round((discountedLineSubtotal * (l.taxPercent || 0)) / 100);
  }, 0);

  const totalCents = subtotalCents - discountCents + taxCents;

  return { subtotalCents, discountCents, taxCents, totalCents };
}
