"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MONTH_LABELS, type BudgetCategory } from "@/components/finance/budget-grid";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function cellStatus(
  type: "income" | "expense",
  planned: number,
  actual: number
): "success" | "destructive" | "neutral" {
  if (planned === 0 && actual === 0) return "neutral";
  if (type === "expense") return actual <= planned ? "success" : "destructive";
  return actual >= planned ? "success" : "destructive";
}

export function RendicontoGrid({
  categories,
  planned,
  actuals,
}: {
  categories: BudgetCategory[];
  planned: Map<string, number>; // key: `${categoryId}-${month}`
  actuals: Map<string, number>; // key: `${categoryId}-${month}`
}) {
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
              <TableHead key={m} className="min-w-20 text-right">
                {m}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <Group label="Uscite" categories={expenseCategories} planned={planned} actuals={actuals} />
          <Group label="Entrate" categories={incomeCategories} planned={planned} actuals={actuals} />
        </TableBody>
      </Table>
    </div>
  );
}

function Group({
  label,
  categories,
  planned,
  actuals,
}: {
  label: string;
  categories: BudgetCategory[];
  planned: Map<string, number>;
  actuals: Map<string, number>;
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
            const plannedValue = planned.get(key) ?? 0;
            const actualValue = actuals.get(key) ?? 0;
            const status = cellStatus(category.type, plannedValue, actualValue);
            return (
              <TableCell
                key={month}
                className={cn(
                  "text-right font-mono text-xs tabular-nums",
                  status === "success" && "bg-success/10 text-success",
                  status === "destructive" && "bg-destructive/10 text-destructive"
                )}
              >
                {actualValue !== 0 ? currencyFormatter.format(actualValue) : "—"}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
