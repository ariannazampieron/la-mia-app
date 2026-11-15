"use client";

import { useState } from "react";
import { MONTH_LABELS } from "@/lib/finance/months";
import type { MonthlySaved } from "@/lib/finance/monthly-savings";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${currencyFormatter.format(value)}`;

/** Single series: slot 3 of the validated chart palette. */
const SAVED_COLOR = "#1baf7a";

/**
 * What was left each month (income - expenses): columns above the baseline for months
 * that saved, below for months that spent more than they earned; summary table below.
 */
export function SavingsChart({ months }: { months: MonthlySaved[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(...months.map((m) => m.saved), 1);
  const bottom = Math.min(...months.map((m) => m.saved), 0);
  const range = top - bottom;
  const baseline = `${(-bottom / range) * 100}%`;
  const totals = months.reduce(
    (t, m) => ({
      income: t.income + m.income,
      expenses: t.expenses + m.expenses,
      saved: t.saved + m.saved,
    }),
    { income: 0, expenses: 0, saved: 0 }
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="relative h-56">
          <div
            className="border-border absolute inset-x-0 border-t"
            style={{ bottom: baseline }}
          />
          <div className="absolute inset-0 flex">
            {months.map((m, i) => (
              <div
                key={m.month}
                tabIndex={0}
                role="img"
                aria-label={`${MONTH_LABELS[i]}: risparmiato ${signed(m.saved)}`}
                className="relative flex-1 outline-none"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <div
                  className={cn(
                    "absolute inset-x-0 mx-auto w-full max-w-7",
                    m.saved >= 0 ? "rounded-t" : "rounded-b opacity-50",
                    active === i && "opacity-80"
                  )}
                  style={{
                    backgroundColor: SAVED_COLOR,
                    height: `${(Math.abs(m.saved) / range) * 100}%`,
                    ...(m.saved >= 0
                      ? { bottom: baseline }
                      : { top: `calc(100% - ${baseline})` }),
                  }}
                />
                {active === i && (
                  <div className="bg-popover border-border pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 space-y-0.5 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm">
                    <p className="font-semibold">{MONTH_LABELS[i]}</p>
                    <p className="text-muted-foreground">
                      Entrate{" "}
                      <span className="text-foreground font-mono tabular-nums">
                        {currencyFormatter.format(m.income)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Uscite{" "}
                      <span className="text-foreground font-mono tabular-nums">
                        {currencyFormatter.format(m.expenses)}
                      </span>
                    </p>
                    <p className="font-semibold">
                      Risparmiato{" "}
                      <span className="font-mono tabular-nums">
                        {signed(m.saved)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex">
          {months.map((m, i) => (
            <span
              key={m.month}
              className="text-muted-foreground flex-1 text-center text-[11px]"
            >
              {MONTH_LABELS[i]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mese</TableHead>
              <TableHead className="text-right">Entrate</TableHead>
              <TableHead className="text-right">Uscite</TableHead>
              <TableHead className="text-right">Risparmiato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m, i) => (
              <TableRow key={m.month}>
                <TableCell>{MONTH_LABELS[i]}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {currencyFormatter.format(m.income)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {currencyFormatter.format(m.expenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono font-semibold tabular-nums",
                    m.saved < 0 && "text-destructive"
                  )}
                >
                  {signed(m.saved)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totale</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {currencyFormatter.format(totals.income)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {currencyFormatter.format(totals.expenses)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {signed(totals.saved)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
