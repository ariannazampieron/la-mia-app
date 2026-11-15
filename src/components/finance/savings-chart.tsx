"use client";

import { useState } from "react";
import { MONTH_LABELS } from "@/components/finance/conto-economico-table";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${currencyFormatter.format(value)}`;

/** Categorical slots 1 and 3 of the validated chart palette (checked as a pair). */
const SERIES = [
  { key: "fondoTasse", label: "Fondo tasse", color: "#2a78d6" },
  { key: "risparmio", label: "Risparmio", color: "#1baf7a" },
] as const;

/**
 * Stacked monthly columns of what went into the savings account, split into tax fund and
 * savings; months where money came out go below the baseline. Hover/focus shows the month.
 */
export function SavingsChart({
  months,
}: {
  months: { fondoTasse: number; risparmio: number }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const positives = months.map(
    (m) => Math.max(m.fondoTasse, 0) + Math.max(m.risparmio, 0)
  );
  const negatives = months.map(
    (m) => Math.min(m.fondoTasse, 0) + Math.min(m.risparmio, 0)
  );
  const top = Math.max(...positives, 1);
  const bottom = Math.min(...negatives, 0);
  const range = top - bottom;
  const pct = (value: number) => `${(Math.abs(value) / range) * 100}%`;
  const baseline = `${(-bottom / range) * 100}%`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs">
        {SERIES.map((s) => (
          <span
            key={s.key}
            className="text-muted-foreground flex items-center gap-1.5"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative h-56">
        <div
          className="border-border absolute inset-x-0 border-t"
          style={{ bottom: baseline }}
        />
        <div className="absolute inset-0 flex">
          {months.map((m, i) => (
            <div
              key={i}
              tabIndex={0}
              role="img"
              aria-label={`${MONTH_LABELS[i]}: fondo tasse ${signed(m.fondoTasse)}, risparmio ${signed(m.risparmio)}`}
              className="relative flex-1 outline-none"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {/* Above the baseline: tax fund at the bottom, savings on top. */}
              <div
                className="absolute inset-x-0 mx-auto flex w-full max-w-7 flex-col-reverse gap-[2px]"
                style={{ bottom: baseline, height: pct(positives[i]) }}
              >
                {SERIES.map((s) =>
                  m[s.key] > 0 ? (
                    <div
                      key={s.key}
                      className={cn(
                        "w-full first:rounded-b-none last:rounded-t",
                        active === i && "opacity-85"
                      )}
                      style={{
                        backgroundColor: s.color,
                        height: `${(m[s.key] / positives[i]) * 100}%`,
                      }}
                    />
                  ) : null
                )}
              </div>
              {negatives[i] < 0 && (
                <div
                  className="absolute inset-x-0 mx-auto flex w-full max-w-7 flex-col gap-[2px]"
                  style={{
                    top: `calc(100% - ${baseline})`,
                    height: pct(negatives[i]),
                  }}
                >
                  {SERIES.map((s) =>
                    m[s.key] < 0 ? (
                      <div
                        key={s.key}
                        className="w-full opacity-50 last:rounded-b"
                        style={{
                          backgroundColor: s.color,
                          height: `${(m[s.key] / negatives[i]) * 100}%`,
                        }}
                      />
                    ) : null
                  )}
                </div>
              )}
              {active === i && (
                <div className="bg-popover border-border pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 space-y-0.5 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm">
                  <p className="font-semibold">{MONTH_LABELS[i]}</p>
                  {SERIES.map((s) => (
                    <p key={s.key} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="ml-auto pl-3 font-mono tabular-nums">
                        {signed(m[s.key])}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        {months.map((_, i) => (
          <span
            key={i}
            className="text-muted-foreground flex-1 text-center text-[11px]"
          >
            {MONTH_LABELS[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
