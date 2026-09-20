import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type Settings = {
  id: number;
  businessName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoDataUrl: string | null;
  gstin: string | null;
  defaultCurrency: string;
  defaultTaxName: string;
  defaultTaxPercent: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  quotePrefix: string;
  nextQuoteNumber: number;
  defaultTermsInvoice: string | null;
  defaultTermsQuote: string | null;
  upiId: string | null;
  bankDetails: string | null;
  reminderBeforeDaysJson: string;
  reminderOnDueDate: boolean;
  reminderAfterDaysJson: string;
  reminderMaxAfterCount: number;
  updatedAt: Date;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  gstin: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoices: Invoice[];
  quotations: Quotation[];
  _count: {
    invoices: number;
    quotations: number;
  };
};

export type Item = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  rateCents: number;
  taxPercent: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  itemId: string | null;
  description: string;
  quantity: number;
  unit: string;
  rateCents: number;
  taxPercent: number;
  lineSubtotalCents: number;
  lineTaxCents: number;
  lineTotalCents: number;
  sortOrder: number;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amountCents: number;
  date: Date;
  method: string;
  note: string | null;
  createdAt: Date;
  invoice: Invoice;
};

export type ReminderLog = {
  id: string;
  invoiceId: string;
  type: string;
  daysOffset: number;
  sentAt: Date;
  success: boolean;
  error: string | null;
  invoice: { number: string; client: { name: string; email?: string | null } };
};

export type Invoice = {
  id: string;
  publicId: string;
  number: string;
  status: string;
  clientId: string;
  quotationId: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  discountType: string;
  discountValue: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  notes: string | null;
  terms: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  lastReminderAt: Date | null;
  reminderCount: number;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: InvoiceItem[];
  payments: Payment[];
  reminders: ReminderLog[];
  client: Client;
  _count: {
    payments: number;
    items?: number;
    reminders?: number;
  };
};

export type QuotationItem = {
  id: string;
  quotationId: string;
  itemId: string | null;
  description: string;
  quantity: number;
  unit: string;
  rateCents: number;
  taxPercent: number;
  lineSubtotalCents: number;
  lineTaxCents: number;
  lineTotalCents: number;
  sortOrder: number;
};

export type Quotation = {
  id: string;
  publicId: string;
  number: string;
  status: string;
  clientId: string;
  issueDate: Date;
  expiryDate: Date | null;
  currency: string;
  discountType: string;
  discountValue: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  terms: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  respondedAt: Date | null;
  clientNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: QuotationItem[];
  client: Client;
  invoices: Invoice[];
  _count?: {
    items?: number;
    invoices?: number;
  };
};

export type DbSchema = {
  settings: any;
  clients: any[];
  items: any[];
  invoices: any[];
  quotations: any[];
  payments: any[];
  reminderLogs: any[];
};

function getDbPath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'invoicing-db.json');
  }
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'invoicing-db.json');
}

function getSeedDbPath(): string {
  return path.join(process.cwd(), 'data', 'seed-db.json');
}

function getDefaultDb(): DbSchema {
  const seedPath = getSeedDbPath();
  if (fs.existsSync(seedPath)) {
    try {
      return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    } catch {
      // fallback
    }
  }
  return {
    settings: {
      id: 1,
      businessName: 'The Sprout Media',
      email: 'contact@thesproutmedia.com',
      phone: '',
      address: '',
      logoDataUrl: null,
      gstin: null,
      defaultCurrency: 'INR',
      defaultTaxName: 'GST',
      defaultTaxPercent: 18,
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
      quotePrefix: 'QUO-',
      nextQuoteNumber: 1,
      defaultTermsInvoice: 'Payment due within 15 days.',
      defaultTermsQuote: 'Valid for 30 days.',
      upiId: null,
      bankDetails: null,
      reminderBeforeDaysJson: '[3,1]',
      reminderOnDueDate: true,
      reminderAfterDaysJson: '[1,3,7,14]',
      reminderMaxAfterCount: 4,
      updatedAt: new Date().toISOString()
    },
    clients: [],
    items: [],
    invoices: [],
    quotations: [],
    payments: [],
    reminderLogs: []
  };
}

let inMemoryDb: DbSchema | null = null;

export function readDb(): DbSchema {
  const filePath = getDbPath();
  if (inMemoryDb) return inMemoryDb;
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      inMemoryDb = data;
      return data;
    } catch (err) {
      console.warn('Could not parse db.json, using default seed:', err);
    }
  }
  const def = getDefaultDb();
  inMemoryDb = def;
  try {
    fs.writeFileSync(filePath, JSON.stringify(def, null, 2), 'utf8');
  } catch (err) {
    console.warn('Warning writing initial db to disk:', err);
  }
  return def;
}

export function writeDb(db: DbSchema): void {
  inMemoryDb = db;
  const filePath = getDbPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not write to db file:', err);
  }
}

function genId(): string {
  return 'c' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function toDate(d: any): Date {
  return d instanceof Date ? d : new Date(d);
}

function toDateNullable(d: any): Date | null {
  return d ? (d instanceof Date ? d : new Date(d)) : null;
}

function hydrateClient(c: any, db: DbSchema): Client {
  const invoices = (db.invoices || []).filter((i: any) => i.clientId === c.id);
  const quotations = (db.quotations || []).filter((q: any) => q.clientId === c.id);
  return {
    ...c,
    createdAt: toDate(c.createdAt),
    updatedAt: toDate(c.updatedAt),
    invoices: invoices.map((i: any) => hydrateInvoice(i, db)),
    quotations: quotations.map((q: any) => hydrateQuotation(q, db)),
    _count: {
      invoices: invoices.length,
      quotations: quotations.length
    }
  };
}

function hydrateInvoice(inv: any, db: DbSchema): Invoice {
  const rawClient = (db.clients || []).find((c: any) => c.id === inv.clientId) || {
    id: inv.clientId,
    name: 'Unknown Client',
    email: null,
    phone: null,
    billingAddress: null,
    shippingAddress: null,
    gstin: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    invoices: [],
    quotations: [],
    _count: { invoices: 0, quotations: 0 }
  };

  const client: Client = {
    ...rawClient,
    createdAt: toDate(rawClient.createdAt),
    updatedAt: toDate(rawClient.updatedAt),
    invoices: [],
    quotations: [],
    _count: {
      invoices: 0,
      quotations: 0
    }
  };

  const items: InvoiceItem[] = (inv.items || []).map((it: any) => ({ ...it }));
  const payments: Payment[] = (db.payments || [])
    .filter((p: any) => p.invoiceId === inv.id)
    .map((p: any) => ({
      ...p,
      date: toDate(p.date),
      createdAt: toDate(p.createdAt),
      invoice: null as any
    }));

  const reminders: ReminderLog[] = (db.reminderLogs || [])
    .filter((r: any) => r.invoiceId === inv.id)
    .map((r: any) => ({
      ...r,
      sentAt: toDate(r.sentAt),
      invoice: { number: inv.number, client: { name: client.name, email: client.email } }
    }));

  return {
    ...inv,
    issueDate: toDate(inv.issueDate),
    dueDate: toDate(inv.dueDate),
    sentAt: toDateNullable(inv.sentAt),
    viewedAt: toDateNullable(inv.viewedAt),
    paidAt: toDateNullable(inv.paidAt),
    lastReminderAt: toDateNullable(inv.lastReminderAt),
    cancelledAt: toDateNullable(inv.cancelledAt),
    createdAt: toDate(inv.createdAt),
    updatedAt: toDate(inv.updatedAt),
    items,
    payments,
    reminders,
    client,
    _count: {
      payments: payments.length,
      items: items.length,
      reminders: reminders.length
    }
  };
}

function hydrateQuotation(q: any, db: DbSchema): Quotation {
  const rawClient = (db.clients || []).find((c: any) => c.id === q.clientId) || {
    id: q.clientId,
    name: 'Unknown Client',
    email: null,
    phone: null,
    billingAddress: null,
    shippingAddress: null,
    gstin: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    invoices: [],
    quotations: [],
    _count: { invoices: 0, quotations: 0 }
  };

  const client: Client = {
    ...rawClient,
    createdAt: toDate(rawClient.createdAt),
    updatedAt: toDate(rawClient.updatedAt),
    invoices: [],
    quotations: [],
    _count: {
      invoices: 0,
      quotations: 0
    }
  };

  const items: QuotationItem[] = (q.items || []).map((it: any) => ({ ...it }));
  const invoices: Invoice[] = (db.invoices || [])
    .filter((inv: any) => inv.quotationId === q.id)
    .map((inv: any) => hydrateInvoice(inv, db));

  return {
    ...q,
    issueDate: toDate(q.issueDate),
    expiryDate: toDateNullable(q.expiryDate),
    sentAt: toDateNullable(q.sentAt),
    viewedAt: toDateNullable(q.viewedAt),
    respondedAt: toDateNullable(q.respondedAt),
    createdAt: toDate(q.createdAt),
    updatedAt: toDate(q.updatedAt),
    items,
    client,
    invoices,
    _count: {
      items: items.length,
      invoices: invoices.length
    }
  };
}

export const jsonDb = {
  raw: {
    read: readDb,
    write: writeDb
  },

  settings: {
    async findUnique(_args?: any): Promise<Settings> {
      const db = readDb();
      return { ...db.settings, updatedAt: toDate(db.settings.updatedAt) };
    },
    async create(args: { data: Partial<Settings> }): Promise<Settings> {
      const db = readDb();
      db.settings = { ...db.settings, ...args.data, updatedAt: new Date().toISOString() };
      writeDb(db);
      return { ...db.settings, updatedAt: new Date() };
    },
    async update(args: { where?: any; data: Partial<Settings> }): Promise<Settings> {
      const db = readDb();
      db.settings = { ...db.settings, ...args.data, updatedAt: new Date().toISOString() };
      writeDb(db);
      return { ...db.settings, updatedAt: new Date() };
    }
  },

  client: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any }): Promise<Client[]> {
      const db = readDb();
      let res = (db.clients || []).map((c: any) => hydrateClient(c, db));
      if (args?.where?.id) res = res.filter((c) => c.id === args.where.id);
      res.sort((a, b) => a.name.localeCompare(b.name));
      return res;
    },
    async findUnique(args: { where: { id: string }; include?: any }): Promise<Client | null> {
      const db = readDb();
      const raw = (db.clients || []).find((c: any) => c.id === args.where.id);
      return raw ? hydrateClient(raw, db) : null;
    },
    async findUniqueOrThrow(args: { where: { id: string }; include?: any }): Promise<Client> {
      const res = await this.findUnique(args);
      if (!res) throw new Error('Client not found');
      return res;
    },
    async create(args: { data: Partial<Client> }): Promise<Client> {
      const db = readDb();
      const now = new Date().toISOString();
      const newClient = {
        id: args.data.id || genId(),
        name: args.data.name || '',
        email: args.data.email || null,
        phone: args.data.phone || null,
        billingAddress: args.data.billingAddress || null,
        shippingAddress: args.data.shippingAddress || null,
        gstin: args.data.gstin || null,
        notes: args.data.notes || null,
        createdAt: now,
        updatedAt: now
      };
      if (!db.clients) db.clients = [];
      db.clients.push(newClient);
      writeDb(db);
      return hydrateClient(newClient, db);
    },
    async update(args: { where: { id: string }; data: Partial<Client> }): Promise<Client> {
      const db = readDb();
      const idx = (db.clients || []).findIndex((c: any) => c.id === args.where.id);
      if (idx === -1) throw new Error('Client not found');
      db.clients[idx] = { ...db.clients[idx], ...args.data, updatedAt: new Date().toISOString() };
      writeDb(db);
      return hydrateClient(db.clients[idx], db);
    },
    async delete(args: { where: { id: string } }): Promise<Client> {
      const db = readDb();
      const idx = (db.clients || []).findIndex((c: any) => c.id === args.where.id);
      if (idx === -1) throw new Error('Client not found');
      const [removed] = db.clients.splice(idx, 1);
      writeDb(db);
      return hydrateClient(removed, db);
    },
    async count(args?: { where?: any }): Promise<number> {
      const db = readDb();
      if (!args?.where) return (db.clients || []).length;
      const clients = await jsonDb.client.findMany(args);
      return clients.length;
    }
  },

  item: {
    async findMany(_args?: any): Promise<Item[]> {
      const db = readDb();
      return (db.items || []).map((i: any) => ({
        ...i,
        createdAt: toDate(i.createdAt),
        updatedAt: toDate(i.updatedAt)
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    async findUnique(args: { where: { id: string } }): Promise<Item | null> {
      const db = readDb();
      const raw = (db.items || []).find((i: any) => i.id === args.where.id);
      return raw ? { ...raw, createdAt: toDate(raw.createdAt), updatedAt: toDate(raw.updatedAt) } : null;
    },
    async findUniqueOrThrow(args: { where: { id: string } }): Promise<Item> {
      const res = await this.findUnique(args);
      if (!res) throw new Error('Item not found');
      return res;
    },
    async create(args: { data: Partial<Item> }): Promise<Item> {
      const db = readDb();
      const now = new Date().toISOString();
      const newItem = {
        id: args.data.id || genId(),
        name: args.data.name || '',
        description: args.data.description || null,
        unit: args.data.unit || 'unit',
        rateCents: args.data.rateCents || 0,
        taxPercent: args.data.taxPercent ?? null,
        createdAt: now,
        updatedAt: now
      };
      if (!db.items) db.items = [];
      db.items.push(newItem);
      writeDb(db);
      return { ...newItem, createdAt: new Date(now), updatedAt: new Date(now) };
    },
    async update(args: { where: { id: string }; data: Partial<Item> }): Promise<Item> {
      const db = readDb();
      const idx = (db.items || []).findIndex((i: any) => i.id === args.where.id);
      if (idx === -1) throw new Error('Item not found');
      db.items[idx] = { ...db.items[idx], ...args.data, updatedAt: new Date().toISOString() };
      writeDb(db);
      return { ...db.items[idx], createdAt: toDate(db.items[idx].createdAt), updatedAt: new Date() };
    },
    async delete(args: { where: { id: string } }): Promise<Item> {
      const db = readDb();
      const idx = (db.items || []).findIndex((i: any) => i.id === args.where.id);
      if (idx === -1) throw new Error('Item not found');
      const [removed] = db.items.splice(idx, 1);
      writeDb(db);
      return { ...removed, createdAt: toDate(removed.createdAt), updatedAt: toDate(removed.updatedAt) };
    },
    async count(args?: { where?: any }): Promise<number> {
      const db = readDb();
      if (!args?.where) return (db.items || []).length;
      const items = await jsonDb.item.findMany(args);
      return items.length;
    }
  },

  invoice: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; select?: any }): Promise<Invoice[]> {
      const db = readDb();
      let res = (db.invoices || []).map((inv: any) => hydrateInvoice(inv, db));
      const w = args?.where;
      if (w) {
        if (w.status) {
          if (typeof w.status === 'string') res = res.filter((i) => i.status === w.status);
          else if (w.status.in) res = res.filter((i) => w.status.in.includes(i.status));
          else if (w.status.not) res = res.filter((i) => i.status !== w.status.not);
        }
        if (w.clientId) res = res.filter((i) => i.clientId === w.clientId);
        if (w.dueDate?.lte) res = res.filter((i) => i.dueDate <= toDate(w.dueDate.lte));
        if (w.createdAt?.gte) res = res.filter((i) => i.createdAt >= toDate(w.createdAt.gte));
        if (w.OR) {
          res = res.filter((inv) =>
            w.OR.some((cond: any) => {
              if (cond.status) {
                if (typeof cond.status === 'string') return inv.status === cond.status;
                if (cond.status.in) return cond.status.in.includes(inv.status);
              }
              if (cond.number?.contains) return inv.number.toLowerCase().includes(cond.number.contains.toLowerCase());
              if (cond.client?.name?.contains) return inv.client.name.toLowerCase().includes(cond.client.name.contains.toLowerCase());
              return false;
            })
          );
        }
      }

      if (args?.orderBy?.createdAt === 'desc') {
        res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else if (args?.orderBy?.dueDate === 'asc') {
        res.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      }

      if (args?.take) res = res.slice(0, args.take);
      return res;
    },

    async findUnique(args: { where: any; include?: any }): Promise<Invoice | null> {
      const db = readDb();
      const w = args.where;
      const raw = (db.invoices || []).find((i: any) => {
        if (w.id) return i.id === w.id;
        if (w.publicId) return i.publicId === w.publicId;
        if (w.number) return i.number === w.number;
        return false;
      });
      return raw ? hydrateInvoice(raw, db) : null;
    },

    async findUniqueOrThrow(args: { where: any; include?: any }): Promise<Invoice> {
      const res = await this.findUnique(args);
      if (!res) throw new Error('Invoice not found');
      return res;
    },

    async create(args: { data: any; include?: any }): Promise<Invoice> {
      const db = readDb();
      const now = new Date().toISOString();
      const id = genId();
      const publicId = genId();

      const items = (args.data.items?.create || []).map((item: any, idx: number) => ({
        id: genId(),
        invoiceId: id,
        itemId: item.itemId || null,
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'unit',
        rateCents: item.rateCents || 0,
        taxPercent: item.taxPercent || 0,
        lineSubtotalCents: item.lineSubtotalCents || 0,
        lineTaxCents: item.lineTaxCents || 0,
        lineTotalCents: item.lineTotalCents || 0,
        sortOrder: item.sortOrder !== undefined ? item.sortOrder : idx
      }));

      const newInvoice = {
        id,
        publicId,
        number: args.data.number,
        status: args.data.status || 'DRAFT',
        clientId: args.data.clientId,
        quotationId: args.data.quotationId || null,
        issueDate: args.data.issueDate ? toDate(args.data.issueDate).toISOString() : now,
        dueDate: args.data.dueDate ? toDate(args.data.dueDate).toISOString() : now,
        currency: args.data.currency || 'INR',
        discountType: args.data.discountType || 'NONE',
        discountValue: args.data.discountValue || 0,
        subtotalCents: args.data.subtotalCents || 0,
        discountCents: args.data.discountCents || 0,
        taxCents: args.data.taxCents || 0,
        totalCents: args.data.totalCents || 0,
        amountPaidCents: args.data.amountPaidCents || 0,
        balanceDueCents: args.data.balanceDueCents || args.data.totalCents || 0,
        notes: args.data.notes || null,
        terms: args.data.terms || null,
        sentAt: args.data.sentAt ? toDate(args.data.sentAt).toISOString() : null,
        viewedAt: null,
        paidAt: null,
        lastReminderAt: null,
        reminderCount: 0,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
        items
      };

      if (!db.invoices) db.invoices = [];
      db.invoices.push(newInvoice);
      writeDb(db);

      return hydrateInvoice(newInvoice, db);
    },

    async update(args: { where: any; data: any; include?: any }): Promise<Invoice> {
      const db = readDb();
      const idx = (db.invoices || []).findIndex(
        (i: any) => (args.where.id && i.id === args.where.id) || (args.where.publicId && i.publicId === args.where.publicId)
      );
      if (idx === -1) throw new Error('Invoice not found');

      const existing = db.invoices[idx];
      const data = args.data;

      let items = existing.items || [];
      if (data.items?.deleteMany) items = [];
      if (data.items?.create) {
        items = data.items.create.map((item: any, i: number) => ({
          id: genId(),
          invoiceId: existing.id,
          itemId: item.itemId || null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rateCents: item.rateCents,
          taxPercent: item.taxPercent,
          lineSubtotalCents: item.lineSubtotalCents,
          lineTaxCents: item.lineTaxCents,
          lineTotalCents: item.lineTotalCents,
          sortOrder: i
        }));
      }

      const updated = {
        ...existing,
        ...data,
        items,
        updatedAt: new Date().toISOString()
      };
      delete (updated as any).items?.deleteMany;
      delete (updated as any).items?.create;

      db.invoices[idx] = updated;
      writeDb(db);

      return hydrateInvoice(updated, db);
    },

    async updateMany(args: { where: { id: { in: string[] } }; data: any }): Promise<{ count: number }> {
      const db = readDb();
      let count = 0;
      const ids = args.where.id.in;
      (db.invoices || []).forEach((inv: any) => {
        if (ids.includes(inv.id)) {
          Object.assign(inv, args.data, { updatedAt: new Date().toISOString() });
          count++;
        }
      });
      if (count > 0) writeDb(db);
      return { count };
    },

    async delete(args: { where: any }): Promise<Invoice> {
      const db = readDb();
      const idx = (db.invoices || []).findIndex(
        (i: any) => (args.where.id && i.id === args.where.id) || (args.where.publicId && i.publicId === args.where.publicId)
      );
      if (idx === -1) throw new Error('Invoice not found');
      const [removed] = db.invoices.splice(idx, 1);
      db.payments = (db.payments || []).filter((p: any) => p.invoiceId !== removed.id);
      db.reminderLogs = (db.reminderLogs || []).filter((r: any) => r.invoiceId !== removed.id);
      writeDb(db);
      return hydrateInvoice(removed, db);
    },

    async count(args?: { where?: any }): Promise<number> {
      const invoices = await jsonDb.invoice.findMany({ where: args?.where });
      return invoices.length;
    },

    async aggregate(args: { _sum?: any; _count?: boolean; where?: any }): Promise<any> {
      const invoices = await jsonDb.invoice.findMany({ where: args.where });
      const res: any = {};
      if (args._count) res._count = invoices.length;
      if (args._sum) {
        res._sum = {};
        if (args._sum.balanceDueCents) {
          res._sum.balanceDueCents = invoices.reduce((s, i) => s + (i.balanceDueCents || 0), 0);
        }
        if (args._sum.totalCents) {
          res._sum.totalCents = invoices.reduce((s, i) => s + (i.totalCents || 0), 0);
        }
      }
      return res;
    }
  },

  quotation: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; select?: any }): Promise<Quotation[]> {
      const db = readDb();
      let res = (db.quotations || []).map((q: any) => hydrateQuotation(q, db));
      const w = args?.where;
      if (w) {
        if (w.status) {
          if (typeof w.status === 'string') res = res.filter((q) => q.status === w.status);
          else if (w.status.in) res = res.filter((q) => w.status.in.includes(q.status));
        }
        if (w.clientId) res = res.filter((q) => q.clientId === w.clientId);
        if (w.OR) {
          res = res.filter((q) =>
            w.OR.some((cond: any) => {
              if (cond.number?.contains) return q.number.toLowerCase().includes(cond.number.contains.toLowerCase());
              if (cond.client?.name?.contains) return q.client.name.toLowerCase().includes(cond.client.name.contains.toLowerCase());
              return false;
            })
          );
        }
      }

      if (args?.orderBy?.createdAt === 'desc') {
        res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return res;
    },

    async findUnique(args: { where: any; include?: any }): Promise<Quotation | null> {
      const db = readDb();
      const w = args.where;
      const raw = (db.quotations || []).find((q: any) => {
        if (w.id) return q.id === w.id;
        if (w.publicId) return q.publicId === w.publicId;
        if (w.number) return q.number === w.number;
        return false;
      });
      return raw ? hydrateQuotation(raw, db) : null;
    },

    async findUniqueOrThrow(args: { where: any; include?: any }): Promise<Quotation> {
      const res = await this.findUnique(args);
      if (!res) throw new Error('Quotation not found');
      return res;
    },

    async create(args: { data: any; include?: any }): Promise<Quotation> {
      const db = readDb();
      const now = new Date().toISOString();
      const id = genId();
      const publicId = genId();

      const items = (args.data.items?.create || []).map((item: any, idx: number) => ({
        id: genId(),
        quotationId: id,
        itemId: item.itemId || null,
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'unit',
        rateCents: item.rateCents || 0,
        taxPercent: item.taxPercent || 0,
        lineSubtotalCents: item.lineSubtotalCents || 0,
        lineTaxCents: item.lineTaxCents || 0,
        lineTotalCents: item.lineTotalCents || 0,
        sortOrder: item.sortOrder !== undefined ? item.sortOrder : idx
      }));

      const newQuote = {
        id,
        publicId,
        number: args.data.number,
        status: args.data.status || 'DRAFT',
        clientId: args.data.clientId,
        issueDate: args.data.issueDate ? toDate(args.data.issueDate).toISOString() : now,
        expiryDate: args.data.expiryDate ? toDate(args.data.expiryDate).toISOString() : null,
        currency: args.data.currency || 'INR',
        discountType: args.data.discountType || 'NONE',
        discountValue: args.data.discountValue || 0,
        subtotalCents: args.data.subtotalCents || 0,
        discountCents: args.data.discountCents || 0,
        taxCents: args.data.taxCents || 0,
        totalCents: args.data.totalCents || 0,
        notes: args.data.notes || null,
        terms: args.data.terms || null,
        sentAt: args.data.sentAt ? toDate(args.data.sentAt).toISOString() : null,
        viewedAt: null,
        respondedAt: null,
        clientNote: null,
        createdAt: now,
        updatedAt: now,
        items
      };

      if (!db.quotations) db.quotations = [];
      db.quotations.push(newQuote);
      writeDb(db);

      return hydrateQuotation(newQuote, db);
    },

    async update(args: { where: any; data: any; include?: any }): Promise<Quotation> {
      const db = readDb();
      const idx = (db.quotations || []).findIndex(
        (q: any) => (args.where.id && q.id === args.where.id) || (args.where.publicId && q.publicId === args.where.publicId)
      );
      if (idx === -1) throw new Error('Quotation not found');

      const existing = db.quotations[idx];
      const data = args.data;

      let items = existing.items || [];
      if (data.items?.deleteMany) items = [];
      if (data.items?.create) {
        items = data.items.create.map((item: any, i: number) => ({
          id: genId(),
          quotationId: existing.id,
          itemId: item.itemId || null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rateCents: item.rateCents,
          taxPercent: item.taxPercent,
          lineSubtotalCents: item.lineSubtotalCents,
          lineTaxCents: item.lineTaxCents,
          lineTotalCents: item.lineTotalCents,
          sortOrder: i
        }));
      }

      const updated = {
        ...existing,
        ...data,
        items,
        updatedAt: new Date().toISOString()
      };
      delete (updated as any).items?.deleteMany;
      delete (updated as any).items?.create;

      db.quotations[idx] = updated;
      writeDb(db);

      return hydrateQuotation(updated, db);
    },

    async delete(args: { where: any }): Promise<Quotation> {
      const db = readDb();
      const idx = (db.quotations || []).findIndex(
        (q: any) => (args.where.id && q.id === args.where.id) || (args.where.publicId && q.publicId === args.where.publicId)
      );
      if (idx === -1) throw new Error('Quotation not found');
      const [removed] = db.quotations.splice(idx, 1);
      writeDb(db);
      return hydrateQuotation(removed, db);
    },

    async count(args?: { where?: any }): Promise<number> {
      const quotes = await jsonDb.quotation.findMany({ where: args?.where });
      return quotes.length;
    },

    async aggregate(args: { _sum?: any; _count?: boolean; where?: any }): Promise<any> {
      const quotes = await jsonDb.quotation.findMany({ where: args.where });
      const res: any = {};
      if (args._count) res._count = quotes.length;
      if (args._sum?.totalCents) {
        res._sum = { totalCents: quotes.reduce((s, q) => s + (q.totalCents || 0), 0) };
      }
      return res;
    }
  },

  payment: {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; select?: any }): Promise<Payment[]> {
      const db = readDb();
      let res = (db.payments || []).map((p: any) => {
        const inv = (db.invoices || []).find((i: any) => i.id === p.invoiceId);
        return {
          ...p,
          date: toDate(p.date),
          createdAt: toDate(p.createdAt),
          invoice: inv ? hydrateInvoice(inv, db) : (null as any)
        };
      });

      if (args?.where?.date?.gte) {
        res = res.filter((p) => p.date >= toDate(args.where.date.gte));
      }
      if (args?.orderBy?.date === 'desc') {
        res.sort((a, b) => b.date.getTime() - a.date.getTime());
      }
      return res;
    },

    async create(args: { data: any }): Promise<Payment> {
      const db = readDb();
      const now = new Date().toISOString();
      const newPayment = {
        id: genId(),
        invoiceId: args.data.invoiceId,
        amountCents: args.data.amountCents,
        date: args.data.date ? toDate(args.data.date).toISOString() : now,
        method: args.data.method || 'Other',
        note: args.data.note || null,
        createdAt: now
      };
      if (!db.payments) db.payments = [];
      db.payments.push(newPayment);
      writeDb(db);

      const inv = (db.invoices || []).find((i: any) => i.id === newPayment.invoiceId);
      return {
        ...newPayment,
        date: toDate(newPayment.date),
        createdAt: toDate(newPayment.createdAt),
        invoice: inv ? hydrateInvoice(inv, db) : (null as any)
      };
    },

    async delete(args: { where: { id: string } }): Promise<Payment> {
      const db = readDb();
      const idx = (db.payments || []).findIndex((p: any) => p.id === args.where.id);
      if (idx === -1) throw new Error('Payment not found');
      const [removed] = db.payments.splice(idx, 1);
      writeDb(db);
      const inv = (db.invoices || []).find((i: any) => i.id === removed.invoiceId);
      return {
        ...removed,
        date: toDate(removed.date),
        createdAt: toDate(removed.createdAt),
        invoice: inv ? hydrateInvoice(inv, db) : (null as any)
      };
    },

    async aggregate(args: { _sum?: any; where?: any }): Promise<any> {
      const payments = await jsonDb.payment.findMany({ where: args.where });
      const res: any = {};
      if (args._sum?.amountCents) {
        res._sum = { amountCents: payments.reduce((s, p) => s + (p.amountCents || 0), 0) };
      }
      return res;
    },

    async count(args?: { where?: any }): Promise<number> {
      const payments = await jsonDb.payment.findMany({ where: args?.where });
      return payments.length;
    }
  },

  reminderLog: {
    async findMany(args?: { include?: any; orderBy?: any; take?: number }): Promise<ReminderLog[]> {
      const db = readDb();
      let res = (db.reminderLogs || []).map((r: any) => {
        const inv = (db.invoices || []).find((i: any) => i.id === r.invoiceId);
        const client = inv ? (db.clients || []).find((c: any) => c.id === inv.clientId) : null;
        return {
          ...r,
          sentAt: toDate(r.sentAt),
          invoice: {
            number: inv?.number || 'INV',
            client: { name: client?.name || 'Unknown', email: client?.email || null }
          }
        };
      });

      if (args?.orderBy?.sentAt === 'desc') {
        res.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
      }
      if (args?.take) res = res.slice(0, args.take);
      return res;
    },

    async create(args: { data: any }): Promise<ReminderLog> {
      const db = readDb();
      const now = new Date().toISOString();
      const newLog = {
        id: genId(),
        invoiceId: args.data.invoiceId,
        type: args.data.type,
        daysOffset: args.data.daysOffset,
        sentAt: args.data.sentAt ? toDate(args.data.sentAt).toISOString() : now,
        success: args.data.success ?? true,
        error: args.data.error || null
      };
      if (!db.reminderLogs) db.reminderLogs = [];
      db.reminderLogs.push(newLog);
      writeDb(db);

      const inv = (db.invoices || []).find((i: any) => i.id === newLog.invoiceId);
      const client = inv ? (db.clients || []).find((c: any) => c.id === inv.clientId) : null;
      return {
        ...newLog,
        sentAt: toDate(newLog.sentAt),
        invoice: {
          number: inv?.number || 'INV',
          client: { name: client?.name || 'Unknown', email: client?.email || null }
        }
      };
    },

    async count(args?: { where?: any }): Promise<number> {
      const logs = await jsonDb.reminderLog.findMany();
      return logs.length;
    }
  },

  invoiceItem: {
    async deleteMany(args: { where: any }): Promise<{ count: number }> {
      const db = readDb();
      let count = 0;
      if (args?.where?.invoiceId) {
        const inv = (db.invoices || []).find((i: any) => i.id === args.where.invoiceId);
        if (inv && Array.isArray(inv.items)) {
          count = inv.items.length;
          inv.items = [];
          writeDb(db);
        }
      }
      return { count };
    }
  },

  quotationItem: {
    async deleteMany(args: { where: any }): Promise<{ count: number }> {
      const db = readDb();
      let count = 0;
      if (args?.where?.quotationId) {
        const q = (db.quotations || []).find((quo: any) => quo.id === args.where.quotationId);
        if (q && Array.isArray(q.items)) {
          count = q.items.length;
          q.items = [];
          writeDb(db);
        }
      }
      return { count };
    }
  },

  $transaction: async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === 'function') {
      return arg(jsonDb);
    }
    return arg;
  }
};
