"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  AccountCard,
  type AccountSummary,
} from "@/components/finance/account-card";
import { LastImportNote } from "@/components/finance/last-import-note";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastImportDate, setLastImportDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error("Impossibile caricare i conti");
        const body = await res.json();
        if (!cancelled) setAccounts(body.accounts);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Errore imprevisto");
      }
    }
    load();
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled)
          setLastImportDate(body?.lastStatementImportDate ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conti</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Imposta il saldo di partenza di ciascun conto: il saldo corrente viene
          poi calcolato sommando le transazioni importate o inserite
          manualmente.
        </p>
        <LastImportNote date={lastImportDate} />
      </div>

      {error && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!accounts && !error && (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {accounts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              tone="sage"
              onUpdated={(updated) =>
                setAccounts((prev) =>
                  prev
                    ? prev.map((a) => (a.id === updated.id ? updated : a))
                    : prev
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
