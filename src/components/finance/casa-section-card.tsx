"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Check } from "lucide-react";
import { CARD_TONES, type CardTone } from "@/lib/finance/card-tones";
import type { CasaSectionKey } from "@/lib/finance/casa-sections";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

interface CasaYearValue {
  year: number;
  amount: number;
  isManual: boolean;
  editable: boolean;
}

export function CasaSectionCard({
  sectionKey,
  label,
  values,
  tone,
  onSaved,
}: {
  sectionKey: CasaSectionKey;
  label: string;
  values: CasaYearValue[];
  tone: CardTone;
  onSaved: (year: number, amount: number) => void;
}) {
  const colors = CARD_TONES[tone];
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  const total = values.reduce((sum, v) => sum + v.amount, 0);

  async function handleSave(year: number) {
    const amount = Number(draftValue) || 0;
    setSaving(year);
    try {
      const res = await fetch("/api/casa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: sectionKey, year, amount }),
      });
      if (!res.ok) throw new Error("Salvataggio non riuscito");
      onSaved(year, amount);
      setEditingYear(null);
    } catch {
      toast.error("Impossibile salvare il totale per questo anno");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card style={{ borderTopWidth: "4px", borderTopColor: colors.bg }}>
      <CardHeader>
        <CardTitle
          className="text-sm font-semibold tracking-wider uppercase"
          style={{ color: colors.text }}
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground">
          {currencyFormatter.format(total)}
        </p>

        <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
          {values.map((v) => (
            <div key={v.year} className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                {v.year}
                {!v.isManual && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    auto
                  </Badge>
                )}
              </dt>
              {editingYear === v.year ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(v.year)}
                    className="h-7 w-28 text-right font-mono text-xs"
                  />
                  <button
                    onClick={() => handleSave(v.year)}
                    disabled={saving === v.year}
                    aria-label="Salva"
                    className="shrink-0"
                  >
                    {saving === v.year ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-success" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 font-mono text-sm font-medium tabular-nums text-foreground disabled:cursor-default"
                  onClick={() => {
                    if (!v.editable) return;
                    setEditingYear(v.year);
                    setDraftValue(String(v.amount));
                  }}
                  disabled={!v.editable}
                >
                  {currencyFormatter.format(v.amount)}
                  {v.editable && <Pencil className="h-3 w-3 opacity-50" />}
                </button>
              )}
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
