"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportDialog } from "@/components/finance/import-dialog";
import { DeleteAllTransactionsButton } from "@/components/finance/delete-all-transactions-button";
import { TransactionForm } from "@/components/finance/transaction-form";
import {
  TransactionsTable,
  type TransactionRow,
} from "@/components/finance/transactions-table";

interface AccountOption {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
  type: "income" | "expense";
}

const ALL = "__all__";
const UNCATEGORIZED = "__uncategorized__";

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[] | null>(
    null
  );
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const [accountFilter, setAccountFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionRow | null>(null);

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    if (accountFilter !== ALL) params.set("accountId", accountFilter);
    if (categoryFilter !== ALL) params.set("categoryId", categoryFilter);
    if (typeFilter !== ALL) params.set("type", typeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Impossibile caricare le transazioni");
      const body = await res.json();
      setTransactions(body.transactions);
      setTotal(body.total);
      setPageSize(body.pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    }
  }, [accountFilter, categoryFilter, typeFilter, dateFrom, dateTo, page]);

  // Any filter change should reset back to page 1.
  useEffect(() => {
    setPage(1);
  }, [accountFilter, categoryFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories"),
        ]);
        if (!accountsRes.ok || !categoriesRes.ok) {
          throw new Error("Impossibile caricare conti e categorie");
        }
        const accountsBody = await accountsRes.json();
        const categoriesBody = await categoriesRes.json();
        setAccounts(accountsBody.accounts);
        setCategories(categoriesBody.categories);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore imprevisto");
      }
    }
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const relevantCategories =
    typeFilter === ALL
      ? categories
      : categories.filter((c) => c.type === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transazioni</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Importa i tuoi estratti conto o aggiungi una transazione manuale.
          </p>
        </div>
        <div className="flex gap-2">
          <DeleteAllTransactionsButton onDeleted={loadTransactions} />
          <Button
            variant="outline"
            onClick={() => {
              setEditingTransaction(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Aggiungi manuale
          </Button>
          {accounts.length > 0 && (
            <ImportDialog accounts={accounts} onImported={loadTransactions} />
          )}
        </div>
      </div>

      {error && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Conto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutti i conti</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value);
            setCategoryFilter(ALL);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutti i tipi</SelectItem>
            <SelectItem value="income">Entrate</SelectItem>
            <SelectItem value="expense">Uscite</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutte le categorie</SelectItem>
            <SelectItem value={UNCATEGORIZED}>Da categorizzare</SelectItem>
            {relevantCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
            aria-label="Data inizio"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
            aria-label="Data fine"
          />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Azzera periodo
            </Button>
          )}
        </div>
      </div>

      {!transactions && !error && (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {transactions && (
        <>
          <TransactionsTable
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            onEdit={(tx) => {
              setEditingTransaction(tx);
              setFormOpen(true);
            }}
            onDeleted={(id) =>
              setTransactions(
                (prev) => prev?.filter((t) => t.id !== id) ?? prev
              )
            }
          />

          {total > 0 && (
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <p>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{" "}
                di {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedente
                </Button>
                <span className="px-1">
                  Pagina {page} di {Math.max(1, Math.ceil(total / pageSize))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= total}
                >
                  Successiva
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        accounts={accounts}
        categories={categories}
        transaction={editingTransaction}
        onSaved={loadTransactions}
      />
    </div>
  );
}
