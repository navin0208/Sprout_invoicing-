'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/money';

export type RevenuePoint = { label: string; invoicedCents: number; collectedCents: number };

// Grouped bars: what you billed vs what actually landed, month by month.
// Two series → legend always shown; values surface on hover (the gold series
// sits under 3:1 against the surface, so labels carry identity, not colour
// alone). One shared y-scale — both series are money in the same currency.
export function RevenueChart({ data, currency = 'INR' }: { data: RevenuePoint[]; currency?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...data.flatMap((d) => [d.invoicedCents, d.collectedCents]), 1);
  const allZero = data.every((d) => d.invoicedCents === 0 && d.collectedCents === 0);

  const barHeight = (cents: number) => `${cents > 0 ? Math.max((cents / max) * 100, 2) : 0}%`;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="section-title">Billed vs collected</h2>
          <p className="text-xs text-gray-500 mt-0.5">Last 6 months</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gold-600" />
            Billed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sprout-500" />
            Collected
          </span>
        </div>
      </div>

      {allZero ? (
        <div className="h-44 flex items-center justify-center text-sm text-gray-400 text-center px-6">
          No billing activity yet — once you send your first invoice, this fills in.
        </div>
      ) : (
        <div>
          <div className="relative">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
            <span className="absolute -top-2 right-0 bg-white px-1 text-[10px] text-gray-400 tnum">
              {formatMoney(max, currency)}
            </span>

            <div className="flex items-end justify-between gap-2 h-40 border-b border-gray-200 pt-5">
              {data.map((point, i) => {
                const active = hovered === i;
                const dim = hovered !== null && !active;
                return (
                  <div
                    key={point.label}
                    className="relative flex-1 h-full flex items-end justify-center gap-[2px] cursor-default"
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {active ? (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 whitespace-nowrap rounded-lg bg-brand-800 px-2.5 py-1.5 text-[11px] leading-relaxed text-white shadow-lift animate-pop-in">
                        <span className="block tnum">
                          Billed <strong className="font-semibold">{formatMoney(point.invoicedCents, currency)}</strong>
                        </span>
                        <span className="block tnum">
                          Collected <strong className="font-semibold">{formatMoney(point.collectedCents, currency)}</strong>
                        </span>
                      </div>
                    ) : null}
                    <div
                      className="w-[40%] max-w-[20px] rounded-t bg-gold-600 origin-bottom animate-grow-up transition-opacity duration-150"
                      style={{ height: barHeight(point.invoicedCents), animationDelay: `${i * 60}ms`, opacity: dim ? 0.4 : 1 }}
                    />
                    <div
                      className="w-[40%] max-w-[20px] rounded-t bg-sprout-500 origin-bottom animate-grow-up transition-opacity duration-150"
                      style={{
                        height: barHeight(point.collectedCents),
                        animationDelay: `${i * 60 + 30}ms`,
                        opacity: dim ? 0.4 : 1
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between gap-2 mt-2">
            {data.map((point, i) => (
              <span
                key={point.label}
                className={`flex-1 text-center text-[11px] transition-colors ${
                  hovered === i ? 'font-semibold text-brand-800' : 'text-gray-400'
                }`}
              >
                {point.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
