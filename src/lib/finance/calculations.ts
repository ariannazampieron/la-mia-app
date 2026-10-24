import { db } from "@/lib/db";
import { financeAccounts, transactions, categories } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";

export const TAX_RATE = 0.23;

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

/** Total revenue for the year: sum of income transactions in "Clienti_*" categories. */
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

/** Fondo Tasse = 23% del fatturato annuale - imposte già pagate nell'anno. */
export async function getFondoTasse(
  userId: string,
  year: number
): Promise<number> {
  const [fatturato, imposte] = await Promise.all([
    getFatturatoAnnuale(userId, year),
    getImposteAnnuali(userId, year),
  ]);
  return fatturato * TAX_RATE - imposte;
}

/** Risparmio = saldo del conto di risparmio - fondo tasse. */
export async function getRisparmio(
  userId: string,
  year: number
): Promise<number> {
  const [savingsAccount] = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        eq(financeAccounts.isSavingsAccount, true)
      )
    )
    .limit(1);

  if (!savingsAccount) return 0;

  const [balance, fondoTasse] = await Promise.all([
    getAccountBalance(savingsAccount.id),
    getFondoTasse(userId, year),
  ]);
  return balance - fondoTasse;
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
