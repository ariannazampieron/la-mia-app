"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContoEconomicoTable,
  type ContoEconomicoCategory,
  type MonthBalance,
} from "@/components/finance/conto-economico-table";
import { BudgetImportDialog } from "@/components/finance/budget-import-dialog";

interface BudgetEntry {
  categoryId: string;
  month: number;
  plannedAmount: string;
}
interface ActualRow {
  categoryId: string | null;
  month: number;
  total: string;
}

export default function BudgetPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [categories, setCategories] = useState<ContoEconomicoCategory[]>([]);

  const [plannedAmounts, setPlannedAmounts] = useState<Map<string, number>>(
    new Map()
  );
  const [plannedBalances, setPlannedBalances] = useState<MonthBalance[]>([]);

  const [actualAmounts, setActualAmounts] = useState<Map<string, number>>(
    new Map()
  );
  const [actualBalances, setActualBalances] = useState<MonthBalance[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesRes, budgetRes, actualsRes] = await Promise.all([
        fetch("/api/categories"),
        fetch(`/api/budget?year=${year}`),
        fetch(`/api/budget/actuals?year=${year}`),
      ]);
      if (!categoriesRes.ok || !budgetRes.ok || !actualsRes.ok) {
        throw new Error("Impossibile caricare budget e rendiconto");
      }
      const categoriesBody = await categoriesRes.json();
      const budgetBody: { entries: BudgetEntry[]; balances: MonthBalance[] } =
        await budgetRes.json();
      const actualsBody: { actuals: ActualRow[]; balances: MonthBalance[] } =
        await actualsRes.json();

      setCategories(categoriesBody.categories);
      setPlannedAmounts(
        new Map(
          budgetBody.entries.map((e) => [
            `${e.categoryId}-${e.month}`,
            Number(e.plannedAmount),
          ])
        )
      );
      setPlannedBalances(budgetBody.balances);
      setActualAmounts(
        new Map(
          actualsBody.actuals
            .filter((a) => a.categoryId)
            .map((a) => [`${a.categoryId}-${a.month}`, Number(a.total)])
        )
      );
      setActualBalances(actualsBody.balances);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handlePlannedAmountChange(
    categoryId: string,
    month: number,
    value: number
  ) {
    setPlannedAmounts((prev) =>
      new Map(prev).set(`${categoryId}-${month}`, value)
    );
    try {
      const res = await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, categoryId, plannedAmount: value }),
      });
      if (!res.ok) throw new Error();
      await loadAll();
    } catch {
      toast.error("Impossibile salvare il budget per questa cella");
    }
  }

  async function handleOpeningBalanceChange(month: number, value: number) {
    try {
      const res = await fetch("/api/budget/opening-balance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, amount: value }),
      });
      if (!res.ok) throw new Error();
      await loadAll();
    } catch {
      toast.error("Impossibile salvare il saldo di apertura");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Budget &amp; Rendiconto
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Budget annuale: ricavi, costi, cash flow e liquidità proiettata mese
            per mese.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BudgetImportDialog
            year={year}
            categories={categories}
            onImported={loadAll}
          />
          <div className="border-border flex items-center gap-2 rounded-full border px-1 py-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-14 text-center font-mono text-sm font-bold tabular-nums">
              {year}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && !error && (
        <Tabs defaultValue="budget">
          <TabsList>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="rendiconto">Rendiconto</TabsTrigger>
          </TabsList>
          <TabsContent value="budget" className="mt-4">
            <ContoEconomicoTable
              mode="budget"
              categories={categories}
              amounts={plannedAmounts}
              balances={plannedBalances}
              onAmountChange={handlePlannedAmountChange}
              onOpeningBalanceChange={handleOpeningBalanceChange}
            />
          </TabsContent>
          <TabsContent value="rendiconto" className="mt-4">
            <ContoEconomicoTable
              mode="rendiconto"
              categories={categories}
              amounts={actualAmounts}
              compareAmounts={plannedAmounts}
              balances={actualBalances}
              compareBalances={plannedBalances}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
