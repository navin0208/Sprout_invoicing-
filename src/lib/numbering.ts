import { prisma } from './prisma';
import { getSettings } from './settings';

// Atomically claims the next invoice/quotation number so two concurrent
// creates never collide. SQLite serializes writes, so a plain
// read-then-increment inside one call is safe here.

export async function nextInvoiceNumber(): Promise<string> {
  const settings = await getSettings();
  const number = `${settings.invoicePrefix}${String(settings.nextInvoiceNumber).padStart(4, '0')}`;
  await prisma.settings.update({
    where: { id: 1 },
    data: { nextInvoiceNumber: settings.nextInvoiceNumber + 1 }
  });
  return number;
}

export async function nextQuoteNumber(): Promise<string> {
  const settings = await getSettings();
  const number = `${settings.quotePrefix}${String(settings.nextQuoteNumber).padStart(4, '0')}`;
  await prisma.settings.update({
    where: { id: 1 },
    data: { nextQuoteNumber: settings.nextQuoteNumber + 1 }
  });
  return number;
}
