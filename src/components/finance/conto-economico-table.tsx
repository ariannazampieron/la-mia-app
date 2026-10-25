"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const MONTH_LABELS = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

export interface ContoEconomicoCategory {
  id: string;
  name: string;
  type: "income" | "expense";
}

export interface MonthBalance {
  month: number;
  opening: number;
  closing: number;
  revenueTotal: number;
  costTotal: number;
  cashFlow: number;
}

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function varianceStatus(
  type: "income" | "expense",
  planned: number,
  actual: number
): "success" | "destructive" | "neutral" {
  if (planned === 0 && actual === 0) return "neutral";
  if (type === "expense") return actual <= planned ? "success" : "destructive";
  return actual >= planned ? "success" : "destructive";
}

export function ContoEconomicoTable({
  mode,
  categories,
  amounts,
  compareAmounts,
  balances,
  onAmountChange,
  onOpeningBalanceChange,
}: {
  mode: "budget" | "rendiconto";
  categories: ContoEconomicoCategory[];
  /** key: `${categoryId}-${month}` → amount shown in each cell (planned for budget, actual for rendiconto) */
  amounts: Map<string, number>;
  /** rendiconto only: the planned amount per cell, used to color actual vs plan */
  compareAmounts?: Map<string, number>;
  balances: MonthBalance[];
  onAmountChange?: (categoryId: string, month: number, value: number) => void;
  onOpeningBalanceChange?: (month: number, value: number) => void;
}) {
  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const balanceByMonth = new Map(balances.map((b) => [b.month, b]));

  const yearRevenueTotal = balances.reduce((sum, b) => sum + b.revenueTotal, 0);
  const yearCostTotal = balances.reduce((sum, b) => sum + b.costTotal, 0);
  const yearCashFlow = balances.reduce((sum, b) => sum + b.cashFlow, 0);
  const decemberClosing = balanceByMonth.get(12)?.closing ?? 0;
  const januaryOpening = balanceByMonth.get(1)?.opening ?? 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-48 bg-accent/60">—</TableHead>
            {MONTH_LABELS.map((m) => (
              <TableHead key={m} className="min-w-24 text-right">
                {m}
              </TableHead>
            ))}
            <TableHead className="min-w-28 text-right">Totale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <BalanceRow
            label="Saldo conto corrente"
            totalValue={januaryOpening}
            values={MONTH_LABELS.map((_, i) => balanceByMonth.get(i + 1)?.opening ?? 0)}
            editable={mode === "budget"}
            onChange={onOpeningBalanceChange}
          />

          <SectionBand label="Entrate" />
          {incomeCategories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              amounts={amounts}
              compareAmounts={compareAmounts}
              mode={mode}
              onAmountChange={onAmountChange}
            />
          ))}
          <TotalRow
            label="Totale ricavi"
            tone="success"
            totalValue={yearRevenueTotal}
            values={MONTH_LABELS.map((_, i) => balanceByMonth.get(i + 1)?.revenueTotal ?? 0)}
          />

          <SectionBand label="Costi" />
          {expenseCategories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              amounts={amounts}
              compareAmounts={compareAmounts}
              mode={mode}
              onAmountChange={onAmountChange}
            />
          ))}
          <TotalRow
            label="Totale costi"
            tone="destructive"
            totalValue={yearCostTotal}
            values={MONTH_LABELS.map((_, i) => balanceByMonth.get(i + 1)?.costTotal ?? 0)}
          />

          <TotalRow
            label="Cash flow (entrate - uscite)"
            tone="neutral"
            totalValue={yearCashFlow}
            values={MONTH_LABELS.map((_, i) => balanceByMonth.get(i + 1)?.cashFlow ?? 0)}
          />
          <BalanceRow
            label="Liquidità disponibile fine mese"
            totalValue={decemberClosing}
            values={MONTH_LABELS.map((_, i) => balanceByMonth.get(i + 1)?.closing ?? 0)}
            editable={false}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function SectionBand({ label }: { label: string }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={14}
        className="sticky left-0 border-y-0 bg-gradient-to-r from-navy to-primary py-2 text-[11px] font-bold tracking-wider text-white uppercase"
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

function CategoryRow({
  category,
  amounts,
  compareAmounts,
  mode,
  onAmountChange,
}: {
  category: ContoEconomicoCategory;
  amounts: Map<string, number>;
  compareAmounts?: Map<string, number>;
  mode: "budget" | "rendiconto";
  onAmountChange?: (categoryId: string, month: number, value: number) => void;
}) {
  const [saving, setSaving] = useState<number | null>(null);

  async function handleBlur(month: number, value: string) {
    if (!onAmountChange) return;
    const amount = Number(value) || 0;
    const key = `${category.id}-${month}`;
    if (amounts.get(key) === amount) return;
    setSaving(month);
    try {
      onAmountChange(category.id, month, amount);
    } finally {
      setSaving(null);
    }
  }

  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 bg-card">{category.name}</TableCell>
      {MONTH_LABELS.map((_, index) => {
        const month = index + 1;
        const key = `${category.id}-${month}`;
        const value = amounts.get(key) ?? 0;

        if (mode === "budget") {
          return (
            <TableCell key={month} className="p-1">
              <Input
                type="number"
                step="0.01"
                defaultValue={value}
                key={`${key}-${value}`}
                onBlur={(e) => handleBlur(month, e.target.value)}
                disabled={saving === month}
                className="h-8 text-right font-mono text-xs tabular-nums"
              />
            </TableCell>
          );
        }

        const planned = compareAmounts?.get(key) ?? 0;
        const status = varianceStatus(category.type, planned, value);
        return (
          <TableCell
            key={month}
            className={cn(
              "text-right font-mono text-xs tabular-nums",
              status === "success" && "bg-success/10 text-success",
              status === "destructive" && "bg-destructive/10 text-destructive"
            )}
          >
            {value !== 0 ? currencyFormatter.format(value) : "—"}
          </TableCell>
        );
      })}
      <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
        {currencyFormatter.format(
          MONTH_LABELS.reduce((sum, _, i) => sum + (amounts.get(`${category.id}-${i + 1}`) ?? 0), 0)
        )}
      </TableCell>
    </TableRow>
  );
}

function TotalRow({
  label,
  tone,
  values,
  totalValue,
}: {
  label: string;
  tone: "success" | "destructive" | "neutral";
  values: number[];
  totalValue: number;
}) {
  return (
    <TableRow
      className={cn(
        "border-t-2 font-bold hover:bg-transparent",
        tone === "success" && "border-t-success bg-success/5 text-success",
        tone === "destructive" && "border-t-destructive bg-destructive/5 text-destructive",
        tone === "neutral" && "border-t-primary bg-primary/5 text-primary"
      )}
    >
      <TableCell className="sticky left-0 z-10 bg-inherit text-[11px] tracking-wider uppercase">
        {label}
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className="text-right font-mono text-xs tabular-nums">
          {currencyFormatter.format(v)}
        </TableCell>
      ))}
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {currencyFormatter.format(totalValue)}
      </TableCell>
    </TableRow>
  );
}

function BalanceRow({
  label,
  values,
  totalValue,
  editable,
  onChange,
}: {
  label: string;
  values: number[];
  totalValue: number;
  editable: boolean;
  onChange?: (month: number, value: number) => void;
}) {
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <TableRow className="bg-muted/40 font-medium hover:bg-muted/40">
      <TableCell className="sticky left-0 z-10 bg-muted/40 text-[11px] tracking-wider text-muted-foreground uppercase">
        {label}
      </TableCell>
      {values.map((v, i) => {
        const month = i + 1;
        if (editable && editingMonth === month) {
          return (
            <TableCell key={month} className="p-1">
              <Input
                type="number"
                step="0.01"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  onChange?.(month, Number(draft) || 0);
                  setEditingMonth(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onChange?.(month, Number(draft) || 0);
                    setEditingMonth(null);
                  }
                }}
                className="h-8 text-right font-mono text-xs tabular-nums"
              />
            </TableCell>
          );
        }
        return (
          <TableCell
            key={month}
            className={cn(
              "text-right font-mono text-xs tabular-nums",
              editable && "cursor-pointer hover:bg-accent"
            )}
            onClick={() => {
              if (!editable) return;
              setEditingMonth(month);
              setDraft(String(v));
            }}
          >
            {currencyFormatter.format(v)}
          </TableCell>
        );
      })}
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {currencyFormatter.format(totalValue)}
      </TableCell>
    </TableRow>
  );
}
