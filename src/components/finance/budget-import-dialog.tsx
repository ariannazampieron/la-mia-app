"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileSpreadsheet } from "lucide-react";
import type { ContoEconomicoCategory } from "@/components/finance/conto-economico-table";

const SKIP = "__skip";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface ParsedRow {
  label: string;
  /** index 0 = January; null = empty cell, left untouched on import */
  values: (number | null)[];
  categoryId: string;
}

function normalize(name: string) {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Matches a spreadsheet label to a category: exact name first (expenses before income,
 *  since names like UTENZE exist in both), then the part before a "/" (PREVIDENZA/POLIZZE). */
function matchCategory(label: string, categories: ContoEconomicoCategory[]) {
  const ordered = [
    ...categories.filter((c) => c.type === "expense"),
    ...categories.filter((c) => c.type === "income"),
  ];
  const target = normalize(label);
  const exact = ordered.find((c) => normalize(c.name) === target);
  if (exact) return exact.id;
  const prefix = target.split("/")[0]?.trim();
  return ordered.find((c) => normalize(c.name) === prefix)?.id ?? SKIP;
}

function toNumber(cell: unknown): number | null {
  if (typeof cell === "number") return cell;
  if (typeof cell === "string" && cell.trim() !== "") {
    const n = Number(cell.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function BudgetImportDialog({
  year,
  categories,
  onImported,
}: {
  year: number;
  categories: ContoEconomicoCategory[];
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importYear, setImportYear] = useState(year);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFile(null);
    setRows(null);
    setImportYear(year);
  }

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: null,
      });

      // Optional header row: column A empty, columns B–M are months (Excel dates or labels).
      let detectedYear = year;
      let dataRows = raw;
      if (raw[0] && (raw[0][0] === null || raw[0][0] === "")) {
        const firstDate = raw[0].slice(1).find((c) => typeof c === "number");
        if (typeof firstDate === "number") {
          detectedYear = XLSX.SSF.parse_date_code(firstDate)?.y ?? year;
        }
        dataRows = raw.slice(1);
      }

      const parsed = dataRows
        .filter((r) => typeof r[0] === "string" && r[0].trim() !== "")
        .map((r) => ({
          label: String(r[0]).trim(),
          values: Array.from({ length: 12 }, (_, i) => toNumber(r[i + 1])),
          categoryId: matchCategory(String(r[0]), categories),
        }));

      if (parsed.length === 0) {
        toast.error("Nessuna voce trovata nel file.");
        return;
      }
      setImportYear(detectedYear);
      setRows(parsed);
    } catch {
      toast.error("Impossibile leggere il file. Usa un .xlsx o .csv.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!rows) return;
    const entries = rows
      .filter((r) => r.categoryId !== SKIP)
      .flatMap((r) =>
        r.values.flatMap((value, i) =>
          value === null
            ? []
            : [{ categoryId: r.categoryId, month: i + 1, plannedAmount: value }]
        )
      );
    if (entries.length === 0) {
      toast.error("Nessuna voce da importare.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/budget/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: importYear, entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Import non riuscito");
      }
      toast.success(
        `Budget ${importYear} aggiornato (${entries.length} celle)`
      );
      setOpen(false);
      reset();
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSubmitting(false);
    }
  }

  const skippedCount = rows?.filter((r) => r.categoryId === SKIP).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4" />
          Importa da Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importa budget da Excel</DialogTitle>
          <DialogDescription>
            {rows
              ? `Controlla l'abbinamento delle voci. Verranno sovrascritte solo le celle compilate nel file, sul budget ${importYear}.`
              : "Colonna A: nome della voce. Colonne B–M: importi da gennaio a dicembre. La prima riga può contenere i mesi."}
          </DialogDescription>
        </DialogHeader>

        {!rows && (
          <form onSubmit={handleParse} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="budget-import-file">File (.xlsx o .csv)</Label>
              <Input
                id="budget-import-file"
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading || !file}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Analizza file
              </Button>
            </DialogFooter>
          </form>
        )}

        {rows && (
          <div className="space-y-4">
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {rows.map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className="border-border flex items-center gap-3 overflow-hidden rounded-md border px-3 py-2"
                >
                  <p className="min-w-0 flex-1 truncate text-sm">{row.label}</p>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    {currencyFormatter.format(
                      row.values.reduce<number>((s, v) => s + (v ?? 0), 0)
                    )}
                  </span>
                  <Select
                    value={row.categoryId}
                    onValueChange={(value) =>
                      setRows((prev) =>
                        prev!.map((r, i) =>
                          i === index ? { ...r, categoryId: value } : r
                        )
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-48 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>Non importare</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.type === "income" ? "(entrata)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {row.categoryId === SKIP && (
                    <Badge variant="warning" className="shrink-0">
                      Non abbinata
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {skippedCount > 0 && (
              <p className="text-muted-foreground text-xs">
                {skippedCount} voci non verranno importate.
              </p>
            )}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setRows(null)}
                disabled={submitting}
              >
                Indietro
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Importa nel budget {importYear}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
