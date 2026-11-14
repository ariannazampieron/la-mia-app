"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaxYearCoverage } from "@/lib/finance/taxes";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

/** Remaining taxes for one year, with the editable total due and the tax-fund coverage. */
export function TaxYearCard({
  tax,
  onSaved,
}: {
  tax: TaxYearCoverage;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/fatturato/tax-due", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: tax.year, amount: Number(draft) || 0 }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Impossibile salvare il totale delle imposte");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-t-navy border-t-4">
      <CardHeader>
        <CardTitle className="text-navy text-sm font-semibold tracking-wider uppercase">
          Imposte ancora da pagare nel {tax.year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground font-mono text-3xl font-bold tracking-tight tabular-nums">
          {tax.due === null ? "—" : currencyFormatter.format(tax.remaining)}
        </p>

        <dl className="border-border space-y-1.5 border-t pt-3 text-sm">
          {tax.estimate ? (
            <>
              <Row
                label="Totale stimato da pagare nell'anno"
                value={tax.due ?? 0}
              />
              {tax.estimate.map((line) => (
                <div
                  key={line.label}
                  className="text-muted-foreground flex items-center justify-between gap-2 pl-3 text-xs"
                >
                  <dt>{line.label}</dt>
                  <dd className="font-mono tabular-nums">
                    {currencyFormatter.format(line.value)}
                  </dd>
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                Totale da pagare nell&apos;anno
              </dt>
              {editing ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="h-7 w-32 text-right font-mono text-xs"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    aria-label="Salva"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="text-success h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 font-mono font-medium tabular-nums"
                  onClick={() => {
                    setDraft(tax.due === null ? "" : String(tax.due));
                    setEditing(true);
                  }}
                >
                  {tax.due === null
                    ? "Da inserire"
                    : currencyFormatter.format(tax.due)}
                  <Pencil className="h-3 w-3 opacity-50" />
                </button>
              )}
            </div>
          )}
          <Row label="Già pagato" value={-tax.paid} />
          <Row label="Coperto dal fondo tasse" value={tax.covered} />
        </dl>

        {tax.due !== null && (
          <p
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium",
              tax.shortfall > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success"
            )}
          >
            {tax.shortfall > 0
              ? `Mancano ${currencyFormatter.format(tax.shortfall)} nel fondo tasse`
              : "Coperto interamente dal fondo tasse"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">
        {currencyFormatter.format(value)}
      </dd>
    </div>
  );
}
