"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetGrid, type BudgetCategory } from "@/components/finance/budget-grid";
import { RendicontoGrid } from "@/components/finance/rendiconto-grid";

export default function BudgetPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [planned, setPlanned] = useState<Map<string, number>>(new Map());
  const [actuals, setActuals] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
        const budgetBody = await budgetRes.json();
        const actualsBody = await actualsRes.json();

        if (cancelled) return;

        setCategories(categoriesBody.categories);
        setPlanned(
          new Map(
            budgetBody.entries.map(
              (e: { categoryId: string; month: number; plannedAmount: string }) => [
                `${e.categoryId}-${e.month}`,
                Number(e.plannedAmount),
              ]
            )
          )
        );
        setActuals(
          new Map(
            actualsBody.actuals.map(
              (a: { categoryId: string | null; month: number; total: string }) => [
                `${a.categoryId}-${a.month}`,
                Number(a.total),
              ]
            )
          )
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Errore imprevisto");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [year]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budget & Rendiconto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Budget previsto per categoria e mese, confrontato con il consuntivo reale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center font-mono text-lg font-semibold tabular-nums">
            {year}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
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
            <BudgetGrid
              year={year}
              categories={categories}
              planned={planned}
              onChange={(categoryId, month, value) =>
                setPlanned((prev) => new Map(prev).set(`${categoryId}-${month}`, value))
              }
            />
          </TabsContent>
          <TabsContent value="rendiconto" className="mt-4">
            <RendicontoGrid categories={categories} planned={planned} actuals={actuals} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
