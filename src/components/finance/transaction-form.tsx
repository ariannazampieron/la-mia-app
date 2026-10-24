"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { TransactionRow } from "@/components/finance/transactions-table";

interface AccountOption {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
  type: "income" | "expense";
}

interface TransactionFormValues {
  accountId: string;
  categoryId: string;
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  isInternalTransfer: boolean;
}

const EMPTY_VALUES: TransactionFormValues = {
  accountId: "",
  categoryId: "",
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  type: "expense",
  isInternalTransfer: false,
};

export function TransactionForm({
  open,
  onOpenChange,
  accounts,
  categories,
  transaction,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  transaction: TransactionRow | null;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<TransactionFormValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setValues({
        accountId: transaction.accountId,
        categoryId: transaction.categoryId ?? "",
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        isInternalTransfer: transaction.isInternalTransfer,
      });
    } else {
      setValues({ ...EMPTY_VALUES, accountId: accounts[0]?.id ?? "" });
    }
  }, [open, transaction, accounts]);

  const relevantCategories = categories.filter((c) => c.type === values.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        accountId: values.accountId,
        categoryId: values.categoryId || null,
        date: values.date,
        description: values.description,
        amount: Number(values.amount),
        type: values.type,
        isInternalTransfer: values.isInternalTransfer,
      };
      const res = await fetch(
        transaction ? `/api/transactions/${transaction.id}` : "/api/transactions",
        {
          method: transaction ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Salvataggio non riuscito");
      }
      toast.success(transaction ? "Transazione aggiornata" : "Transazione aggiunta");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Modifica transazione" : "Aggiungi transazione manuale"}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? "Aggiorna i dettagli di questa transazione."
              : "Utile ad esempio per gli addebiti della carta di credito."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input
                id="tx-date"
                type="date"
                required
                value={values.date}
                onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Importo</Label>
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={values.amount}
                onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Descrizione</Label>
            <Input
              id="tx-description"
              required
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-type">Tipo</Label>
              <Select
                value={values.type}
                onValueChange={(value: "income" | "expense") =>
                  setValues((v) => ({ ...v, type: value, categoryId: "" }))
                }
              >
                <SelectTrigger id="tx-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Uscita</SelectItem>
                  <SelectItem value="income">Entrata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-account">Conto</Label>
              <Select
                value={values.accountId}
                onValueChange={(value) => setValues((v) => ({ ...v, accountId: value }))}
              >
                <SelectTrigger id="tx-account" className="w-full">
                  <SelectValue placeholder="Seleziona" />
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-category">Categoria</Label>
            <Select
              value={values.categoryId || undefined}
              onValueChange={(value) => setValues((v) => ({ ...v, categoryId: value }))}
            >
              <SelectTrigger id="tx-category" className="w-full">
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
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={values.isInternalTransfer}
              onCheckedChange={(checked) =>
                setValues((v) => ({ ...v, isInternalTransfer: checked === true }))
              }
            />
            Movimento interno (trasferimento tra i tuoi conti, escluso dal rendiconto)
          </label>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
