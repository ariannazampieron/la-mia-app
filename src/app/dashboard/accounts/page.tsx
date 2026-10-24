"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  AccountCard,
  type AccountSummary,
} from "@/components/finance/account-card";
import type { CardTone } from "@/lib/finance/card-tones";

const NON_SAVINGS_TONES: CardTone[] = ["ochre", "moss", "terracotta", "clay", "sand"];

function toneForAccount(account: AccountSummary, nonSavingsIndex: number): CardTone {
  if (account.isSavingsAccount) return "sage";
  return NON_SAVINGS_TONES[nonSavingsIndex % NON_SAVINGS_TONES.length];
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Imposta il saldo di partenza di ciascun conto: il saldo corrente
          viene poi calcolato sommando le transazioni importate o inserite
          manualmente.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!accounts && !error && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {accounts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(() => {
            let nonSavingsIndex = 0;
            return accounts.map((account) => {
              const tone = toneForAccount(account, nonSavingsIndex);
              if (!account.isSavingsAccount) nonSavingsIndex += 1;
              return (
                <AccountCard
                  key={account.id}
                  account={account}
                  tone={tone}
                  onUpdated={(updated) =>
                    setAccounts((prev) =>
                      prev
                        ? prev.map((a) => (a.id === updated.id ? updated : a))
                        : prev
                    )
                  }
                />
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
