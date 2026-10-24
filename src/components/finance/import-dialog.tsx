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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, AlertCircle, Copy } from "lucide-react";
import type { PreviewRow } from "@/app/api/transactions/import/preview/route";

interface AccountOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: "income" | "expense";
}

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function ImportDialog({
  accounts,
  onImported,
}: {
  accounts: AccountOption[];
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "preview">("select");
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorRows, setErrorRows] = useState<{ rowNumber: number; message: string }[] | null>(
    null
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);
  const [includedDuplicates, setIncludedDuplicates] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("select");
    setFile(null);
    setErrorRows(null);
    setPreviewRows([]);
    setIncludedDuplicates(new Set());
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;
    setLoading(true);
    setErrorRows(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("accountId", accountId);
      const res = await fetch("/api/transactions/import/preview", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.details?.rows) {
          setErrorRows(body.details.rows);
        } else {
          toast.error(body.error ?? "Import non riuscito");
        }
        return;
      }
      setPreviewRows(body.rows);
      setAvailableCategories(body.categories);
      setStep("preview");
    } catch {
      toast.error("Qualcosa è andato storto. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  function updateRowCategory(rowNumber: number, categoryId: string) {
    setPreviewRows((prev) =>
      prev.map((r) =>
        r.rowNumber === rowNumber
          ? {
              ...r,
              categoryId,
              categoryName:
                availableCategories.find((c) => c.id === categoryId)?.name ?? null,
            }
          : r
      )
    );
  }

  async function handleConfirm() {
    const rowsToImport = previewRows.filter(
      (r) => !r.isDuplicate || includedDuplicates.has(r.rowNumber)
    );
    if (rowsToImport.length === 0) {
      toast.error("Nessuna transazione selezionata per l'import.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          rows: rowsToImport.map((r) => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
            type: r.type,
            categoryId: r.categoryId,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Import non riuscito");
      }
      const body = await res.json();
      toast.success(`${body.imported} transazioni importate`);
      setOpen(false);
      reset();
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSubmitting(false);
    }
  }

  const newRows = previewRows.filter((r) => !r.isDuplicate);
  const duplicateRows = previewRows.filter((r) => r.isDuplicate);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" />
          Importa estratto conto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importa estratto conto</DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Carica un file CSV o XLSX con colonne: data, descrizione, importo, entrata/uscita, categoria."
              : "Controlla le transazioni prima di confermare l'import."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <form onSubmit={handlePreview} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="import-account">Conto</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="import-account" className="w-full">
                  <SelectValue placeholder="Seleziona un conto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-file">File (.csv o .xlsx)</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>

            {errorRows && (
              <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Import bloccato — correggi queste righe e riprova
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-destructive/90">
                  {errorRows.map((e) => (
                    <li key={e.rowNumber}>
                      Riga {e.rowNumber}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={loading || !file || !accountId}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Analizza file
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium">
                Nuove transazioni ({newRows.length})
              </h3>
              {newRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nessuna nuova transazione — tutte le righe sono duplicati.
                </p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {newRows.map((row) => (
                    <PreviewRowItem
                      key={row.rowNumber}
                      row={row}
                      categories={availableCategories}
                      onCategoryChange={updateRowCategory}
                    />
                  ))}
                </div>
              )}
            </div>

            {duplicateRows.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
                  <Copy className="h-3.5 w-3.5" />
                  Possibili duplicati ({duplicateRows.length})
                </h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Già presenti con stessa data, importo e descrizione. Seleziona quelli
                  che vuoi importare comunque.
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {duplicateRows.map((row) => (
                    <div
                      key={row.rowNumber}
                      className="flex items-center gap-3 overflow-hidden rounded-md border border-warning/20 bg-warning/5 px-3 py-2"
                    >
                      <Checkbox
                        checked={includedDuplicates.has(row.rowNumber)}
                        onCheckedChange={(checked) =>
                          setIncludedDuplicates((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(row.rowNumber);
                            else next.delete(row.rowNumber);
                            return next;
                          })
                        }
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-sm">{row.description}</p>
                        <p className="text-xs text-muted-foreground">{row.date}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm tabular-nums">
                        {currencyFormatter.format(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-background px-6 py-4">
              <Button variant="ghost" onClick={() => setStep("select")} disabled={submitting}>
                Indietro
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Conferma import
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewRowItem({
  row,
  categories,
  onCategoryChange,
}: {
  row: PreviewRow;
  categories: CategoryOption[];
  onCategoryChange: (rowNumber: number, categoryId: string) => void;
}) {
  const relevantCategories = categories.filter((c) => c.type === row.type);

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-md border border-border px-3 py-2">
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm">{row.description}</p>
        <p className="text-xs text-muted-foreground">{row.date}</p>
      </div>
      <span
        className={`shrink-0 font-mono text-sm tabular-nums ${
          row.type === "income" ? "text-success" : "text-foreground"
        }`}
      >
        {row.type === "income" ? "+" : "-"}
        {currencyFormatter.format(row.amount)}
      </span>
      <Select
        value={row.categoryId ?? undefined}
        onValueChange={(value) => onCategoryChange(row.rowNumber, value)}
      >
        <SelectTrigger size="sm" className="w-40 shrink-0">
          <SelectValue placeholder="Da categorizzare" />
        </SelectTrigger>
        <SelectContent>
          {relevantCategories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!row.categoryId && (
        <Badge variant="warning" className="shrink-0">
          Da categorizzare
        </Badge>
      )}
    </div>
  );
}
