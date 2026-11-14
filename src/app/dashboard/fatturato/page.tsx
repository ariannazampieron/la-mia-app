"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { RevenueChart } from "@/components/finance/revenue-chart";
import { TaxYearCard } from "@/components/finance/tax-year-card";
import type { TaxYearCoverage } from "@/lib/finance/taxes";

interface FatturatoData {
  year: number;
  months: number[];
  total: number;
  clients: { name: string; total: number }[];
  fondoTasse: number;
  taxes: TaxYearCoverage[];
}

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const percentFormatter = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});

export default function FatturatoPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<FatturatoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/fatturato?year=${year}`);
      if (!res.ok) throw new Error("Impossibile caricare fatturato e imposte");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fatturato e imposte
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Fatturato mese per mese e per cliente, imposte ancora da pagare e
            copertura dal fondo tasse.
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

      {!data && !error && (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-baseline justify-between gap-4">
              <CardTitle className="text-sm font-semibold tracking-wider uppercase">
                Fatturato mensile {data.year}
              </CardTitle>
              <span className="font-mono text-lg font-bold tabular-nums">
                {currencyFormatter.format(data.total)}
              </span>
            </CardHeader>
            <CardContent>
              <RevenueChart months={data.months} year={data.year} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wider uppercase">
                Fatturato per cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Fatturato</TableHead>
                    <TableHead className="w-1/3">
                      Incidenza sul totale
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clients.map((client) => {
                    const share =
                      data.total > 0 ? client.total / data.total : 0;
                    return (
                      <TableRow key={client.name}>
                        <TableCell className="font-medium">
                          {client.name}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {currencyFormatter.format(client.total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="bg-muted h-2 flex-1 rounded-full">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${share * 100}%` }}
                              />
                            </div>
                            <span className="w-14 text-right font-mono text-xs tabular-nums">
                              {percentFormatter.format(share)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Totale</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {currencyFormatter.format(data.total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Fondo tasse disponibile:{" "}
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {currencyFormatter.format(data.fondoTasse)}
              </span>{" "}
              — copre prima le imposte del {data.taxes[0]?.year}, poi quelle del{" "}
              {data.taxes[1]?.year}.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {data.taxes.map((tax) => (
                <TaxYearCard key={tax.year} tax={tax} onSaved={load} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
