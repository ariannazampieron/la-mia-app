"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface BudgetCategory {
  id: string;
  name: string;
  type: "income" | "expense";
}

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

export function BudgetGrid({
  year,
  categories,
  planned,
  onChange,
}: {
  year: number;
  categories: BudgetCategory[];
  planned: Map<string, number>; // key: `${categoryId}-${month}`
  onChange: (categoryId: string, month: number, value: number) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  async function handleBlur(categoryId: string, month: number, value: string) {
    const amount = Number(value) || 0;
    const key = `${categoryId}-${month}`;
    if (planned.get(key) === amount) return;

    setSaving(key);
    try {
      const res = await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, categoryId, plannedAmount: amount }),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      onChange(categoryId, month, amount);
    } catch {
      toast.error("Impossibile salvare il budget per questa cella");
    } finally {
      setSaving(null);
    }
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-40 bg-card">
              Categoria
            </TableHead>
            {MONTH_LABELS.map((m) => (
              <TableHead key={m} className="min-w-24 text-right">
                {m}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <CategoryGroupRows
            label="Uscite"
            categories={expenseCategories}
            planned={planned}
            saving={saving}
            onBlur={handleBlur}
          />
          <CategoryGroupRows
            label="Entrate"
            categories={incomeCategories}
            planned={planned}
            saving={saving}
            onBlur={handleBlur}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function CategoryGroupRows({
  label,
  categories,
  planned,
  saving,
  onBlur,
}: {
  label: string;
  categories: BudgetCategory[];
  planned: Map<string, number>;
  saving: string | null;
  onBlur: (categoryId: string, month: number, value: string) => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell
          colSpan={13}
          className="sticky left-0 bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </TableCell>
      </TableRow>
      {categories.map((category) => (
        <TableRow key={category.id}>
          <TableCell className="sticky left-0 z-10 bg-card font-medium">
            {category.name}
          </TableCell>
          {MONTH_LABELS.map((_, index) => {
            const month = index + 1;
            const key = `${category.id}-${month}`;
            return (
              <TableCell key={month} className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={planned.get(key) ?? 0}
                  key={`${key}-${planned.get(key) ?? 0}`}
                  onBlur={(e) => onBlur(category.id, month, e.target.value)}
                  disabled={saving === key}
                  className="h-8 text-right font-mono text-xs tabular-nums"
                />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
