import { z } from 'zod';

// .nullish() (not just .optional()) on every field below since these
// schemas also validate PATCH payloads built from a GET response, and
// Prisma's nullable columns serialize as `null`, not `undefined`.
export const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().nullish().or(z.literal('')),
  phone: z.string().nullish(),
  billingAddress: z.string().nullish(),
  shippingAddress: z.string().nullish(),
  gstin: z.string().nullish(),
  notes: z.string().nullish()
});

export const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullish(),
  unit: z.string().min(1).default('unit'),
  rate: z.number().min(0),
  taxPercent: z.number().min(0).max(100).optional().nullable()
});

export const lineSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive(),
  unit: z.string().min(1).default('unit'),
  rate: z.number().min(0),
  taxPercent: z.number().min(0).max(100)
});

const documentBase = z.object({
  clientId: z.string().min(1, 'Client is required'),
  currency: z.string().min(1).default('INR'),
  discountType: z.enum(['NONE', 'PERCENT', 'FLAT']).default('NONE'),
  discountValue: z.number().min(0).default(0),
  notes: z.string().optional().or(z.literal('')),
  terms: z.string().optional().or(z.literal('')),
  items: z.array(lineSchema).min(1, 'Add at least one line item')
});

export const invoiceSchema = documentBase.extend({
  issueDate: z.string().min(1),
  dueDate: z.string().min(1)
});

export const quotationSchema = documentBase.extend({
  issueDate: z.string().min(1),
  expiryDate: z.string().optional().or(z.literal(''))
});

export const paymentSchema = z.object({
  amount: z.number().positive(),
  date: z.string().min(1),
  method: z.string().min(1).default('Other'),
  note: z.string().optional().or(z.literal(''))
});

// Every optional field here is `.nullable()` in addition to `.optional()`
// because the Settings GET response (this schema's own round-trip source —
// the Settings page loads it and spreads it straight into form state) uses
// `null` for "not set", not `undefined` — Prisma's nullable String columns
// always serialize as `null`, never omitted.
export const settingsSchema = z.object({
  businessName: z.string().min(1),
  email: z.string().email().nullish().or(z.literal('')),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  logoDataUrl: z.string().nullish(),
  gstin: z.string().nullish(),
  defaultCurrency: z.string().min(1),
  defaultTaxName: z.string().min(1),
  defaultTaxPercent: z.number().min(0).max(100),
  invoicePrefix: z.string().min(1),
  nextInvoiceNumber: z.number().int().min(1),
  quotePrefix: z.string().min(1),
  nextQuoteNumber: z.number().int().min(1),
  defaultTermsInvoice: z.string().nullish(),
  defaultTermsQuote: z.string().nullish(),
  upiId: z.string().nullish(),
  bankDetails: z.string().nullish(),
  reminderBeforeDays: z.array(z.number().int().min(0)).default([]),
  reminderOnDueDate: z.boolean().default(true),
  reminderAfterDays: z.array(z.number().int().min(1)).default([]),
  reminderMaxAfterCount: z.number().int().min(0).default(4)
});
