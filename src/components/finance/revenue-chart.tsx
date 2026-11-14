"use client";

import { useState } from "react";
import { MONTH_LABELS } from "@/components/finance/conto-economico-table";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Rounds the axis top up to a clean step (1, 2, 2.5, 5 × 10ⁿ) split in 4 ticks. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

function compact(value: number) {
  return value >= 1000 ? `${value / 1000}K` : String(value);
}

/** Single-series column chart of monthly revenue, with a per-column hover/focus tooltip. */
export function RevenueChart({
  months,
  year,
}: {
  months: number[];
  year: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...months));
  const top = ticks[ticks.length - 1] || 1;

  return (
    <div className="flex gap-3">
      <div className="text-muted-foreground relative h-56 w-10 shrink-0 text-right text-[11px] tabular-nums">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0"
            style={{
              bottom: `${(t / top) * 100}%`,
              transform: "translateY(50%)",
            }}
          >
            {compact(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-56">
          {ticks.map((t) => (
            <div
              key={t}
              className="border-border absolute inset-x-0 border-t"
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex">
            {months.map((value, i) => (
              <div
                key={i}
                tabIndex={0}
                role="img"
                aria-label={`${MONTH_LABELS[i]} ${year}: ${currencyFormatter.format(value)}`}
                className="relative flex flex-1 items-end justify-center outline-none"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <div
                  className={
                    active === i
                      ? "bg-primary/80 w-full max-w-6 rounded-t"
                      : "bg-primary w-full max-w-6 rounded-t"
                  }
                  style={{ height: `${(value / top) * 100}%` }}
                />
                {active === i && (
                  <div className="border-border bg-popover pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-sm">
                    <span className="text-muted-foreground">
                      {MONTH_LABELS[i]} {year}
                    </span>{" "}
                    <span className="text-foreground font-mono font-semibold tabular-nums">
                      {currencyFormatter.format(value)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex">
          {MONTH_LABELS.map((m) => (
            <span
              key={m}
              className="text-muted-foreground flex-1 text-center text-[11px]"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
