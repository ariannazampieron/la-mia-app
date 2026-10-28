"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  CasaSectionCard,
  CasaValueCard,
} from "@/components/finance/casa-section-card";
import type { CasaSectionKey } from "@/lib/finance/casa-sections";

interface CasaYearValue {
  year: number;
  amount: number;
  isManual: boolean;
  editable: boolean;
}

// Sections that add up to the value of the house (running costs excluded).
const VALUE_SECTIONS: CasaSectionKey[] = [
  "acquisto",
  "ristrutturazione",
  "arredamento",
];

interface CasaSection {
  key: CasaSectionKey;
  label: string;
  values: CasaYearValue[];
}

export default function CasaPage() {
  const [sections, setSections] = useState<CasaSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/casa");
        if (!res.ok) throw new Error("Impossibile caricare la sezione Casa");
        const body = await res.json();
        if (!cancelled) setSections(body.sections);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Errore imprevisto");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Casa</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Totali per anno delle spese legate alla casa. Il 2025 (e qualunque
          anno senza transazioni collegate) si compila a mano; dal 2026 i totali
          si aggiornano in automatico dalle transazioni importate.
        </p>
      </div>

      {error && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!sections && !error && (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {sections && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <CasaSectionCard
              key={section.key}
              sectionKey={section.key}
              label={section.label}
              values={section.values}
              tone="sage"
              onSaved={(year, amount) =>
                setSections((prev) =>
                  prev
                    ? prev.map((s) =>
                        s.key === section.key
                          ? {
                              ...s,
                              values: s.values.map((v) =>
                                v.year === year
                                  ? { ...v, amount, isManual: true }
                                  : v
                              ),
                            }
                          : s
                      )
                    : prev
                )
              }
            />
          ))}
          <CasaValueCard
            label="Valore casa"
            parts={sections
              .filter((s) => VALUE_SECTIONS.includes(s.key))
              .map((s) => ({
                label: s.label,
                amount: s.values.reduce((sum, v) => sum + v.amount, 0),
              }))}
          />
        </div>
      )}
    </div>
  );
}
