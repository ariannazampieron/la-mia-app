"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, PiggyBank } from "lucide-react";
import { CARD_TONES, type CardTone } from "@/lib/finance/card-tones";

export interface AccountSummary {
  id: string;
  name: string;
  isSavingsAccount: boolean;
  openingBalance: string;
  openingBalanceDate: string | null;
  currentBalance: number;
}

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function AccountCard({
  account,
  tone,
  onUpdated,
}: {
  account: AccountSummary;
  tone: CardTone;
  onUpdated: (account: AccountSummary) => void;
}) {
  const colors = CARD_TONES[tone];
  const [editing, setEditing] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(account.openingBalance);
  const [openingBalanceDate, setOpeningBalanceDate] = useState(
    account.openingBalanceDate ?? new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingBalance: Number(openingBalance),
          openingBalanceDate,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Salvataggio non riuscito");
      }
      const delta =
        Number(openingBalance) - Number(account.openingBalance);
      onUpdated({
        ...account,
        openingBalance: Number(openingBalance).toFixed(2),
        openingBalanceDate,
        currentBalance: account.currentBalance + delta,
      });
      toast.success("Saldo di partenza aggiornato");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ backgroundColor: colors.bgSoft, borderColor: `${colors.bg}33` }}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle
            className="flex items-center gap-2 text-base"
            style={{ color: colors.text }}
          >
            {account.name}
            {account.isSavingsAccount && (
              <Badge variant="success" className="gap-1">
                <PiggyBank className="h-3 w-3" />
                Risparmio
              </Badge>
            )}
          </CardTitle>
          {!editing && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(true)}
              aria-label="Modifica saldo di partenza"
            >
              <Pencil className="h-3.5 w-3.5" style={{ color: colors.text }} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs" style={{ color: colors.text, opacity: 0.8 }}>
            Saldo corrente
          </p>
          <p
            className="font-mono text-2xl font-semibold tabular-nums"
            style={{ color: colors.text }}
          >
            {currencyFormatter.format(account.currentBalance)}
          </p>
        </div>

        {editing ? (
          <div
            className="space-y-3 border-t pt-4"
            style={{ borderColor: `${colors.bg}33` }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`balance-${account.id}`}>Saldo di partenza</Label>
              <Input
                id={`balance-${account.id}`}
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`date-${account.id}`}>Data saldo di partenza</Label>
              <Input
                id={`date-${account.id}`}
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salva
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setOpeningBalance(account.openingBalance);
                  setOpeningBalanceDate(
                    account.openingBalanceDate ?? new Date().toISOString().slice(0, 10)
                  );
                }}
                disabled={saving}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: colors.text, opacity: 0.8 }}>
            Saldo di partenza: {currencyFormatter.format(Number(account.openingBalance))}
            {account.openingBalanceDate ? ` al ${account.openingBalanceDate}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
