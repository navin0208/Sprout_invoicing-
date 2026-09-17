import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { syncOverdueStatuses } from '@/lib/reminders';
import { formatMoney, formatDate } from '@/lib/money';
import { Topbar } from '@/components/Topbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/Avatar';
import { Icon, IconName } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { RevenueChart, RevenuePoint } from '@/components/RevenueChart';

export const dynamic = 'force-dynamic';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'neutral'
}: {
  label: string;
  value: string;
  sub?: string;
  icon: IconName;
  tone?: 'neutral' | 'good' | 'bad' | 'gold';
}) {
  const tones = {
    neutral: 'bg-brand-50 text-brand-600',
    good: 'bg-sprout-50 text-sprout-600',
    bad: 'bg-red-50 text-red-600',
    gold: 'bg-gold-50 text-gold-700'
  };
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon name={icon} className="w-4 h-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold text-brand-800 tnum">{value}</p>
      {sub ? <p className="text-xs text-gray-400 mt-1">{sub}</p> : null}
    </div>
  );
}

function DatabaseSetupNotice() {
  return (
    <>
      <Topbar title="Dashboard" subtitle="Database configuration required" />
      <main className="p-6 max-w-[1000px] mx-auto space-y-6 animate-slide-up">
        <div className="card p-8 border-2 border-brand-200 bg-gradient-to-br from-white via-white to-brand-50/40 shadow-lift">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Icon name="alert" className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Connect Your Database to Save Data</h1>
              <p className="text-xs text-gray-500">Your organization portal is running live on Vercel!</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            To start creating and permanently storing invoices, quotations, clients, and generating Excel reports, connect a free PostgreSQL database (Neon, Supabase, or Vercel Postgres).
          </p>

          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4 mb-6">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Quick Setup (2 Minutes):</h2>
            <ol className="text-sm text-gray-600 space-y-3 list-decimal list-inside">
              <li>
                Create a free PostgreSQL database at{' '}
                <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-brand-600 font-medium underline">
                  Neon.tech
                </a>{' '}
                or{' '}
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 font-medium underline">
                  Supabase.com
                </a>.
              </li>
              <li>
                Copy your connection string (starts with{' '}
                <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs text-brand-800 font-mono">
                  postgresql://...
                </code>
                ).
              </li>
              <li>
                In your{' '}
                <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-brand-600 font-medium underline">
                  Vercel Project Dashboard
                </a>{' '}
                → <strong>Settings</strong> → <strong>Environment Variables</strong>:
                <div className="mt-1.5 ml-5 text-xs bg-white p-2.5 rounded border border-gray-200 font-mono">
                  Key: <strong>DATABASE_URL</strong>
                  <br />
                  Value: <strong>postgresql://username:password@...neon.tech/neondb?sslmode=require</strong>
                </div>
              </li>
              <li>Go to the <strong>Deployments</strong> tab in Vercel and click <strong>Redeploy</strong>.</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Get Free PostgreSQL on Neon ↗
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open Vercel Settings ↗
            </a>
          </div>
        </div>
      </main>
    </>
  );
}

function DatabaseConnectionError({ error }: { error: string }) {
  return (
    <>
      <Topbar title="Dashboard" subtitle="Database Connection Issue" />
      <main className="p-6 max-w-[1000px] mx-auto space-y-6">
        <div className="card p-6 border border-red-200 bg-red-50/50">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
              <Icon name="alert" className="w-4 h-4" />
            </span>
            <h2 className="text-base font-semibold text-red-900">Database Connection Error</h2>
          </div>
          <p className="text-xs text-red-700 font-mono bg-white/80 p-3 rounded border border-red-100 mb-4 break-all">
            {error}
          </p>
          <p className="text-xs text-gray-600">
            Please verify that your <code className="font-mono font-semibold">DATABASE_URL</code> in Vercel Environment Variables is correct, reachable, and includes <code className="font-mono">?sslmode=require</code>.
          </p>
        </div>
      </main>
    </>
  );
}

export default async function DashboardPage() {
  try {
    await syncOverdueStatuses();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const inSevenDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  const [
    outstanding,
    overdue,
    paidThisMonth,
    invoicedThisMonth,
    recentInvoices,
    needsAttention,
    openQuotes,
    clientCount,
    windowInvoices,
    windowPayments
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { balanceDueCents: true },
      _count: true,
      where: { status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] } }
    }),
    prisma.invoice.aggregate({ _sum: { balanceDueCents: true }, _count: true, where: { status: 'OVERDUE' } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { date: { gte: startOfMonth } } }),
    prisma.invoice.aggregate({
      _sum: { totalCents: true },
      where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } }
    }),
    prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { client: true } }),
    prisma.invoice.findMany({
      where: {
        OR: [
          { status: 'OVERDUE' },
          { status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] }, dueDate: { lte: inSevenDays } }
        ]
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: { client: true }
    }),
    prisma.quotation.aggregate({ _sum: { totalCents: true }, _count: true, where: { status: { in: ['SENT', 'VIEWED'] } } }),
    prisma.client.count(),
    prisma.invoice.findMany({
      where: { createdAt: { gte: sixMonthsAgo }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, totalCents: true }
    }),
    prisma.payment.findMany({ where: { date: { gte: sixMonthsAgo } }, select: { date: true, amountCents: true } })
  ]);

  // Bucket the last six months in memory rather than firing 12 aggregates.
  const buckets: RevenuePoint[] = [];
  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const index = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    index.set(keyOf(d), buckets.length);
    buckets.push({ label: d.toLocaleDateString('en-IN', { month: 'short' }), invoicedCents: 0, collectedCents: 0 });
  }
  for (const inv of windowInvoices) {
    const i = index.get(keyOf(inv.createdAt));
    if (i !== undefined) buckets[i].invoicedCents += inv.totalCents;
  }
  for (const p of windowPayments) {
    const i = index.get(keyOf(p.date));
    if (i !== undefined) buckets[i].collectedCents += p.amountCents;
  }

  const outstandingCents = outstanding._sum.balanceDueCents ?? 0;
  const overdueCents = overdue._sum.balanceDueCents ?? 0;
  const collectedCents = paidThisMonth._sum.amountCents ?? 0;
  const billedCents = invoicedThisMonth._sum.totalCents ?? 0;

  return (
    <>
      <Topbar title="Dashboard" subtitle={`${greeting()} — here's where things stand`} />

      <main className="p-6 space-y-6 max-w-[1400px]">
        {clientCount === 0 ? (
          <div className="card p-5 bg-gold-50 border-gold-200 flex flex-wrap items-center gap-4">
            <span className="w-10 h-10 rounded-xl bg-gold-400 text-brand-800 flex items-center justify-center shrink-0">
              <Icon name="sprout" className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-[240px]">
              <p className="text-sm font-semibold text-brand-800">Let&apos;s get you set up</p>
              <p className="text-sm text-brand-600">Add your first client, then send an invoice or a quotation.</p>
            </div>
            <Link href="/clients" className="btn-primary">
              <Icon name="plus" className="w-4 h-4" />
              Add a client
            </Link>
          </div>
        ) : null}

        {/* Hero: the one number that matters, plus the quickest ways to act on it. */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white shadow-lift">
          <Icon name="sprout" className="absolute -right-6 -bottom-10 w-56 h-56 text-white/[0.04]" strokeWidth={1} />
          <div className="absolute right-0 top-0 w-40 h-40 bg-gold-500/10 blur-3xl rounded-full" />
          <div className="relative p-6 sm:p-7 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total outstanding</p>
              <p className="text-4xl sm:text-5xl font-semibold mt-2 tnum">{formatMoney(outstandingCents)}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-white/70">
                <span>
                  across <strong className="font-semibold text-white">{outstanding._count}</strong> unpaid invoice
                  {outstanding._count === 1 ? '' : 's'}
                </span>
                {overdue._count > 0 ? (
                  <Link href="/invoices?status=OVERDUE" className="inline-flex items-center gap-1.5 text-red-300 hover:text-red-200">
                    <Icon name="alert" className="w-4 h-4" />
                    {formatMoney(overdueCents)} overdue
                    <Icon name="chevronRight" className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sprout-500">
                    <Icon name="checkCircle" className="w-4 h-4" />
                    Nothing overdue
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/export/excel?type=all"
                download
                className="btn border border-white/25 text-white hover:bg-white/10 active:scale-[.98]"
                title="Download comprehensive Excel workbook with all invoices, payments, quotations & clients"
              >
                <Icon name="fileSpreadsheet" className="w-4 h-4 text-emerald-300" />
                Export Excel Report
              </a>
              <Link href="/invoices/new" className="btn-gold">
                <Icon name="plus" className="w-4 h-4" />
                New invoice
              </Link>
              <Link
                href="/quotations/new"
                className="btn border border-white/25 text-white hover:bg-white/10 active:scale-[.98]"
              >
                <Icon name="quotation" className="w-4 h-4" />
                New quotation
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Collected this month"
            value={formatMoney(collectedCents)}
            sub={billedCents > 0 ? `${Math.round((collectedCents / billedCents) * 100)}% of what you billed` : undefined}
            icon="wallet"
            tone="good"
          />
          <StatCard label="Billed this month" value={formatMoney(billedCents)} icon="trendUp" tone="gold" />
          <StatCard
            label="Overdue"
            value={formatMoney(overdueCents)}
            sub={`${overdue._count} invoice${overdue._count === 1 ? '' : 's'} past due`}
            icon="alert"
            tone={overdue._count > 0 ? 'bad' : 'neutral'}
          />
          <StatCard
            label="Quotes awaiting reply"
            value={formatMoney(openQuotes._sum.totalCents ?? 0)}
            sub={`${openQuotes._count} sent, no response yet`}
            icon="quotation"
            tone="neutral"
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RevenueChart data={buckets} />
          </div>

          <div className="card flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="section-title">Needs attention</h2>
              <Icon name="bell" className="w-4 h-4 text-gray-300" />
            </div>
            {needsAttention.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 px-5 text-center">
                <span className="w-11 h-11 rounded-xl bg-sprout-50 text-sprout-600 flex items-center justify-center mb-3">
                  <Icon name="checkCircle" className="w-5 h-5" />
                </span>
                <p className="text-sm font-medium text-brand-800">All clear</p>
                <p className="text-xs text-gray-500 mt-1">Nothing overdue or due in the next 7 days.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {needsAttention.map((inv) => {
                  const late = inv.status === 'OVERDUE';
                  return (
                    <li key={inv.id}>
                      <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gold-50/60 transition-colors">
                        <Avatar name={inv.client.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-brand-800 truncate">{inv.client.name}</p>
                          <p className={`text-xs ${late ? 'text-red-600' : 'text-gray-500'}`}>
                            {inv.number} · {late ? 'overdue' : 'due'} {formatDate(inv.dueDate)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-brand-800 tnum shrink-0">
                          {formatMoney(inv.balanceDueCents, inv.currency)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="section-title">Recent invoices</h2>
            <Link href="/invoices" className="text-xs font-medium text-brand-600 hover:text-gold-700 inline-flex items-center gap-1">
              View all
              <Icon name="chevronRight" className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Create your first invoice and it'll appear here with its payment status."
              actionLabel="Create invoice"
              actionHref="/invoices/new"
            />
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {recentInvoices.map((inv) => {
                  const paidPct =
                    inv.totalCents > 0 ? Math.min(100, Math.round((inv.amountPaidCents / inv.totalCents) * 100)) : 0;
                  return (
                    <tr key={inv.id} className="row-link">
                      <td className="td">
                        <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3">
                          <Avatar name={inv.client.name} />
                          <span>
                            <span className="block font-medium text-brand-800">{inv.client.name}</span>
                            <span className="block text-xs text-gray-500">{inv.number}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="td hidden md:table-cell w-40">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-sprout-500" style={{ width: `${paidPct}%` }} />
                          </div>
                          <span className="text-[11px] text-gray-400 tnum w-8 text-right">{paidPct}%</span>
                        </div>
                      </td>
                      <td className="td hidden sm:table-cell text-gray-500 text-xs">Due {formatDate(inv.dueDate)}</td>
                      <td className="td text-right font-semibold tnum whitespace-nowrap">
                        {formatMoney(inv.totalCents, inv.currency)}
                      </td>
                      <td className="td text-right">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return <DatabaseConnectionError error={message} />;
  }
}
