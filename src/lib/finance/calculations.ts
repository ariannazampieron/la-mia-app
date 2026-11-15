import { db } from "@/lib/db";
import { financeAccounts, transactions, categories } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";

/** Current balance of a single account: opening balance + signed sum of all its transactions. */
export async function getAccountBalance(accountId: string): Promise<number> {
  const [account] = await db
    .select({ openingBalance: financeAccounts.openingBalance })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, accountId))
    .limit(1);

  if (!account) return 0;

  const [row] = await db
    .select({
      signedTotal: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));

  return Number(account.openingBalance) + Number(row?.signedTotal ?? 0);
}

/** Total revenue for the year: income in "Clienti_*" categories. */
export async function getFatturatoAnnuale(
  userId: string,
  year: number
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "income"),
        eq(categories.isClientRevenueCategory, true),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    );
  return Number(row?.total ?? 0);
}

/** Revenue of the year per client ("Clienti_*" category name), highest first. */
export async function getRevenueByClient(
  userId: string,
  year: number
): Promise<{ client: string; total: number }[]> {
  const rows = await db
    .select({
      client: categories.name,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "income"),
        eq(categories.isClientRevenueCategory, true),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    )
    .groupBy(categories.name);
  return rows
    .map((r) => ({ client: r.client, total: Number(r.total) }))
    .sort((a, b) => b.total - a.total);
}

/** Total tax payments for the year: sum of expense transactions in the "Imposte" category. */
export async function getImposteAnnuali(
  userId: string,
  year: number
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        eq(categories.isTaxPaymentCategory, true),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    );
  return Number(row?.total ?? 0);
}

/** The savings account (Conto Arancio Deposito) and its current balance, if it exists. */
export async function getSavingsAccount(
  userId: string
): Promise<{ id: string; name: string; balance: number } | null> {
  const [account] = await db
    .select({ id: financeAccounts.id, name: financeAccounts.name })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        eq(financeAccounts.isSavingsAccount, true)
      )
    )
    .limit(1);
  if (!account) return null;
  return { ...account, balance: await getAccountBalance(account.id) };
}

/** Liquidità disponibile = somma dei saldi di tutti i conti tranne quello di risparmio. */
export async function getLiquiditaDisponibile(userId: string): Promise<number> {
  const nonSavingsAccounts = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        eq(financeAccounts.isSavingsAccount, false)
      )
    );

  const balances = await Promise.all(
    nonSavingsAccounts.map((a) => getAccountBalance(a.id))
  );
  return balances.reduce((sum, b) => sum + b, 0);
}
