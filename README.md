# Invoicing

A self-hosted web app for creating client invoices and quotations, with
automatic email reminders when an invoice is coming due, due today, or
overdue.

## Features

- **Clients & item catalog** — store client contact/billing details once;
  save reusable products/services to add to a document in one click.
- **Invoices & quotations** — line items with quantity/rate/tax, flat or
  percentage discounts, notes & terms, auto-numbering (`INV-0001`, ...),
  multi-currency.
- **PDF generation** — branded PDF for every invoice/quotation (your logo,
  business details, bank details, "amount in words").
- **Client-facing share links** — `/p/invoice/<id>` and `/p/quotation/<id>`
  pages clients can open without logging in, to view, download the PDF, and
  (for quotations) **Accept or Decline** right there.
- **UPI QR code** — if you set a UPI ID in Settings, a scan-to-pay QR code
  is rendered on unpaid invoices (India).
- **Payments & status tracking** — record partial/full payments; status
  moves automatically through Draft → Sent → Viewed → Partially Paid/Overdue
  → Paid.
- **Automatic due-date reminders** — configurable in Settings: remind N days
  before the due date, on the due date, and every N days while overdue (up
  to a max count). Runs on its own daily, or trigger it manually.
- **Convert a quotation to an invoice** in one click once it's accepted.
- **Dashboard** — outstanding balance, overdue amount, collected this month,
  recent invoices, upcoming due dates.
- Single-admin login (this is meant for you, not a multi-tenant SaaS).

## Stack

Next.js (App Router) + TypeScript, Prisma + SQLite, NextAuth (credentials),
Tailwind CSS, `@react-pdf/renderer`, Nodemailer, `node-cron`.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

1. `DATABASE_URL` — leave as-is for a local SQLite file.
2. `APP_URL` / `NEXTAUTH_URL` — the URL this app is reachable at.
3. `NEXTAUTH_SECRET` — any long random string (`npx auth secret` generates one).
4. Your login: run
   ```bash
   npm run make-admin -- you@example.com "your password"
   ```
   and paste the two printed lines (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`) into `.env`.
5. `SMTP_*` — an SMTP account to send invoices/reminders from (a Gmail app
   password works fine, as do Zoho, SendGrid, Resend, etc). Reminders won't
   send without this.
6. `CRON_SECRET` — any random string, only needed if you plan to trigger
   reminders from an external scheduler instead of the built-in one.

Then create the database and start the app:

```bash
npm run db:push
npm run dev
```

Open http://localhost:3000, sign in, and go to **Settings** first to fill in
your business profile, invoice numbering, default tax, bank/UPI details, and
the reminder schedule.

## How the automatic reminders work

A background job (started from `instrumentation.ts`) runs once a day inside
the app process and checks every invoice that's been sent and still has a
balance due. For each one it works out how many days until (or past) the due
date and, if that matches one of the offsets configured in Settings, emails
the client and logs it — so the same reminder is never sent twice. You can
also:

- Click **Send reminder now** on any invoice for an immediate one-off nudge.
- Click **Run reminder sweep now** in Settings to trigger the daily check
  immediately (useful right after changing the schedule).
- Point an external scheduler at `POST /api/cron/reminders` with header
  `x-cron-secret: <CRON_SECRET>` instead of (or in addition to) the built-in
  scheduler — handy if you deploy somewhere serverless where a long-running
  in-process cron isn't available (e.g. Vercel Cron calling that endpoint).

## Production

```bash
npm run build
npm run start
```

`next start` is a long-running Node process, so the in-process reminder
scheduler keeps working. Put it behind a reverse proxy (Caddy/Nginx) with
HTTPS, and back up `prisma/dev.db` periodically — that one file is your
entire database.

## Notes on scope

- Money is stored as integer minor units (paise/cents) to avoid floating
  point rounding errors.
- Only draft invoices/quotations can be edited or deleted, to keep sent
  documents (and anything a client may have already seen or paid against)
  immutable — cancel instead.
- No payment gateway integration (Razorpay/Stripe) — the UPI QR code covers
  the common India "scan to pay" case; recording payments is manual.
