"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostDonut } from "@/components/finance/cost-donut";
import { MONTH_LABELS } from "@/components/finance/conto-economico-table";
import type {
  AverageItem,
  CostAnalysis,
  RecurringItem,
} from "@/lib/finance/cost-analysis";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export default function AnalisiCostiPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<CostAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analisi-costi?year=${year}`)
      .then(async (res) => {
        if (!res.ok)
          throw new Error("Impossibile caricare l'analisi dei costi");
        const body: CostAnalysis = await res.json();
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Errore imprevisto");
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const current = data?.year === year ? data : null;

  const periodLabel =
    current && current.monthsCount > 0
      ? `media su ${current.monthsCount} ${current.monthsCount === 1 ? "mese" : "mesi"} (gen–${MONTH_LABELS[current.monthsCount - 1].toLowerCase()})`
      : "nessun mese con dati";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Analisi costi
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Medie mensili delle spese, spese ricorrenti e utenze di casa.
          </p>
        </div>
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

      {error && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!current && !error && (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {current && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-baseline justify-between gap-4">
              <CardTitle className="text-sm font-semibold tracking-wider uppercase">
                Media mensile delle spese
              </CardTitle>
              <span className="text-muted-foreground text-xs">
                {periodLabel}
              </span>
            </CardHeader>
            <CardContent>
              <CostDonut
                centerLabel="Uscite / mese"
                parts={current.groups.map((g) => ({
                  label: g.label,
                  value: g.monthlyAverage,
                }))}
              />
              <p className="text-muted-foreground mt-4 text-xs">
                Extra esclude Accantonamento e Viaggi; Viaggi è a parte.
              </p>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Spese ricorrenti
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <RecurringCard
                title="Tool personali"
                items={current.tools.personali}
              />
              <RecurringCard title="Tool lavoro" items={current.tools.lavoro} />
            </div>
            <AverageCard title="Telefono e internet" items={current.telecom} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Utenze casa
            </h2>
            <AverageCard title="Utenze" items={current.utilities} showDetail />
          </section>
        </>
      )}
    </div>
  );
}

function RecurringCard({
  title,
  items,
}: {
  title: string;
  items: RecurringItem[];
}) {
  const active = items.filter((i) => !i.dismissed);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wider uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nessuna spesa in questa categoria.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead className="text-right">Mensile</TableHead>
                <TableHead className="text-right">Totale anno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.name}
                  className={
                    item.dismissed ? "text-muted-foreground" : undefined
                  }
                >
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.dismissed && (
                        <Badge variant="warning">Dismesso</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {currencyFormatter.format(item.monthly)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {currencyFormatter.format(item.yearTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Totale attivi</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {currencyFormatter.format(
                    active.reduce((sum, i) => sum + i.monthly, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {currencyFormatter.format(
                    items.reduce((sum, i) => sum + i.yearTotal, 0)
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AverageCard({
  title,
  items,
  showDetail = false,
}: {
  title: string;
  items: AverageItem[];
  showDetail?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wider uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voce</TableHead>
              <TableHead className="text-right">Media mensile</TableHead>
              <TableHead className="text-right">Totale anno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.label}>
                <TableCell>
                  {item.label}
                  {showDetail && item.detail && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {item.detail}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {currencyFormatter.format(item.monthlyAverage)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {currencyFormatter.format(item.yearTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totale</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {currencyFormatter.format(
                  items.reduce((sum, i) => sum + i.monthlyAverage, 0)
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {currencyFormatter.format(
                  items.reduce((sum, i) => sum + i.yearTotal, 0)
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
