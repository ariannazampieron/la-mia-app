"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, Inbox, ArrowLeftRight } from "lucide-react";

export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  categoryId: string | null;
  accountId: string;
  isInternalTransfer: boolean;
  source: "import" | "manual";
}

interface CategoryOption {
  id: string;
  name: string;
}
interface AccountOption {
  id: string;
  name: string;
}

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function TransactionsTable({
  transactions,
  categories,
  accounts,
  onEdit,
  onDeleted,
}: {
  transactions: TransactionRow[];
  categories: CategoryOption[];
  accounts: AccountOption[];
  onEdit: (transaction: TransactionRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Eliminazione non riuscita");
      onDeleted(pendingDeleteId);
      toast.success("Transazione eliminata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Nessuna transazione</p>
          <p className="text-sm text-muted-foreground">
            Importa il tuo primo estratto conto o aggiungi una transazione manuale.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Conto</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {tx.date}
                </TableCell>
                <TableCell className="max-w-64 truncate">
                  <span className="flex items-center gap-1.5">
                    {tx.isInternalTransfer && (
                      <ArrowLeftRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    {tx.description}
                  </span>
                </TableCell>
                <TableCell>
                  {tx.categoryId ? (
                    <Badge variant="outline">{categoryMap.get(tx.categoryId)}</Badge>
                  ) : (
                    <Badge variant="warning">Da categorizzare</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {accountMap.get(tx.accountId)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums ${
                    tx.type === "income" ? "text-success" : "text-foreground"
                  }`}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {currencyFormatter.format(Number(tx.amount))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(tx)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDeleteId(tx.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa transazione?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
