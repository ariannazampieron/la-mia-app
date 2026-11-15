"use client";

import { useState } from "react";
import { List, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CasaDetailYear } from "@/app/api/casa/details/route";
import type { CasaSectionKey } from "@/lib/finance/casa-sections";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "Vedi le voci": the transactions (or hand-entered total) behind each year of a Casa section. */
export function CasaDetailsDialog({
  sectionKey,
  label,
}: {
  sectionKey: CasaSectionKey;
  label: string;
}) {
  const [years, setYears] = useState<CasaDetailYear[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/casa/details?section=${sectionKey}`);
      if (!res.ok) throw new Error();
      const body: { years: CasaDetailYear[] } = await res.json();
      setYears([...body.years].reverse());
    } catch {
      setError("Impossibile caricare le voci");
    }
  }

  return (
    <Dialog onOpenChange={(open) => open && load()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <List className="h-3.5 w-3.5" />
          Vedi le voci
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Le voci considerate in ogni anno. I rimborsi sono in negativo perché
            riducono il totale.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <Button variant="ghost" size="sm" onClick={load}>
              Riprova
            </Button>
          </div>
        )}

        {!years && !error && (
          <div className="text-muted-foreground flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {years?.map((y) => {
          const total = y.items.reduce((sum, i) => sum + i.amount, 0);
          return (
            <section key={y.year} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{y.year}</h3>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {currencyFormatter.format(
                    y.manual ? (y.manualAmount ?? 0) : total
                  )}
                </span>
              </div>
              {y.manual ? (
                <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-sm">
                  Totale inserito a mano: il dettaglio delle voci non è ancora
                  nell&apos;app.
                </p>
              ) : y.items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nessuna transazione in questa sezione.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead>Conto</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {y.items.map((item, i) => (
                        <TableRow key={`${item.date}-${i}`}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {dateFormatter.format(
                              new Date(`${item.date}T00:00:00`)
                            )}
                          </TableCell>
                          <TableCell
                            className="max-w-72 truncate"
                            title={item.description}
                          >
                            {item.description}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {item.account}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono whitespace-nowrap tabular-nums",
                              item.amount < 0 && "text-success"
                            )}
                          >
                            {currencyFormatter.format(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
