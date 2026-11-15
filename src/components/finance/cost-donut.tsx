"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Categorical slots 1–4 of the validated chart palette, in fixed order. */
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

const RADIUS = 80;
const STROKE = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between segments, in the same units as the circumference. */
const GAP = 3;

/**
 * Donut of the parts of a whole, with the total in the middle and a legend (name, amount,
 * share) beside it. Hovering or focusing a segment or a legend row shows that part in the middle.
 */
export function CostDonut({
  centerLabel,
  parts,
}: {
  centerLabel: string;
  parts: { label: string; value: number }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = parts.reduce((sum, p) => sum + p.value, 0);

  // Each segment starts where the previous ones end.
  const shares = parts.map((p) => (total > 0 ? p.value / total : 0));
  const segments = parts.map((part, i) => ({
    ...part,
    share: shares[i],
    color: SERIES_COLORS[i],
    length: Math.max(shares[i] * CIRCUMFERENCE - GAP, 0),
    offset: shares.slice(0, i).reduce((sum, s) => sum + s, 0) * CIRCUMFERENCE,
  }));
  const shown = active === null ? null : segments[active];

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row">
      <div className="relative h-52 w-52 shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-muted"
          />
          {segments.map((s, i) =>
            s.length > 0 ? (
              <circle
                key={s.label}
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={active === i ? STROKE + 6 : STROKE}
                strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
                strokeDashoffset={-s.offset}
                className="cursor-pointer transition-[stroke-width] outline-none"
                tabIndex={0}
                role="img"
                aria-label={`${s.label}: ${currencyFormatter.format(s.value)}, ${percentFormatter.format(s.share)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            ) : null
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-muted-foreground text-xs">
            {shown ? shown.label : centerLabel}
          </span>
          <span className="font-mono text-xl font-bold tabular-nums">
            {currencyFormatter.format(shown ? shown.value : total)}
          </span>
          {shown && (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {percentFormatter.format(shown.share)}
            </span>
          )}
        </div>
      </div>

      <ul className="w-full max-w-sm space-y-3">
        {segments.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-1 text-sm",
              active === i && "bg-muted"
            )}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1">{s.label}</span>
            <span className="font-mono font-semibold tabular-nums">
              {currencyFormatter.format(s.value)}
            </span>
            <span className="text-muted-foreground w-12 text-right font-mono tabular-nums">
              {percentFormatter.format(s.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
