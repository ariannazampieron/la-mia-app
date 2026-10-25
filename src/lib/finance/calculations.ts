import { db } from "@/lib/db";
import { financeAccounts, transactions, categories } from "@/lib/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

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

/**
 * Real liquidity (non-savings accounts only) as of a given cutoff date, EXCLUSIVE —
 * opening balances plus every transaction strictly before `cutoffDate` (yyyy-mm-dd).
 * Used by the Rendiconto cash-flow rows to show the actual liquidity at the start of
 * each month, computed purely from real data (no manual entry needed, unlike the
 * Budget tab's projected balance which has no transactions to draw from).
 */
export async function getLiquidityAsOf(
  userId: string,
  cutoffDate: string
): Promise<number> {
  const nonSavingsAccounts = await db
    .select({ id: financeAccounts.id, openingBalance: financeAccounts.openingBalance })
    .from(financeAccounts)
    .where(
      and(eq(financeAccounts.userId, userId), eq(financeAccounts.isSavingsAccount, false))
    );

  if (nonSavingsAccounts.length === 0) return 0;

  const accountIds = nonSavingsAccounts.map((a) => a.id);
  const openingTotal = nonSavingsAccounts.reduce(
    (sum, a) => sum + Number(a.openingBalance),
    0
  );

  const [row] = await db
    .select({
      signedTotal: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(and(inArray(transactions.accountId, accountIds), lt(transactions.date, cutoffDate)));

  return openingTotal + Number(row?.signedTotal ?? 0);
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
