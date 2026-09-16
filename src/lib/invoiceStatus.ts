import { prisma } from './prisma';

// Recomputes amountPaid/balanceDue from the Payment rows and derives the
// right status from that + the due date. Call this after any payment is
// added or removed, or after an invoice's total changes.
export async function recomputeInvoicePaymentState(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true }
  });

  const amountPaidCents = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
  const balanceDueCents = Math.max(invoice.totalCents - amountPaidCents, 0);

  let status = invoice.status;
  if (status !== 'DRAFT' && status !== 'CANCELLED') {
    if (balanceDueCents <= 0) {
      status = 'PAID';
    } else if (amountPaidCents > 0) {
      status = 'PARTIALLY_PAID';
    } else if (invoice.dueDate.getTime() < Date.now()) {
      status = 'OVERDUE';
    } else if (status === 'PAID') {
      // payment was removed and pushed balance back above zero
      status = 'SENT';
    } else if (status === 'OVERDUE') {
      // the due date was edited forward — it isn't late any more
      status = invoice.viewedAt ? 'VIEWED' : 'SENT';
    }
  }

  // Stamp when it was settled (and clear it if a payment is later removed)
  // so the invoice timeline can show a real date rather than just a state.
  const paidAt =
    status === 'PAID'
      ? invoice.paidAt ??
        invoice.payments.reduce<Date>((latest, p) => (p.date > latest ? p.date : latest), invoice.payments[0]?.date ?? new Date())
      : null;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaidCents, balanceDueCents, status, paidAt }
  });
}
