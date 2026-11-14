import { db } from "@/lib/db";
import { financeAccounts, transactions, categories } from "@/lib/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

export const TAX_RATE = 0.23;

/**
 * Years with a tax regime change: up to `fixedUntilMonth` (included) the tax provision is a
 * known amount, and the 23% only applies to revenue from the following month onwards.
 */
const TAX_REGIME_CHANGES: Record<
  number,
  { fixedAmount: number; fixedUntilMonth: number }
> = {
  2026: { fixedAmount: 22095.33, fixedUntilMonth: 10 },
};

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

/** Total revenue for the year (optionally from `fromMonth`): income in "Clienti_*" categories. */
export async function getFatturatoAnnuale(
  userId: string,
  year: number,
  fromMonth = 1
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
        sql`extract(year from ${transactions.date}) = ${year}`,
        sql`extract(month from ${transactions.date}) >= ${fromMonth}`
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

/** First year the tax fund is tracked: from then on, what's set aside and not paid carries over. */
const TAX_FUND_START_YEAR = 2026;

export interface FondoTasseBreakdown {
  /** Known provision for the months before a regime change (0 in a normal year). */
  fixedAmount: number;
  /** Last month covered by `fixedAmount`, or null in a normal year. */
  fixedUntilMonth: number | null;
  /** Revenue the 23% applies to (whole year, or from the month after a regime change). */
  taxedRevenue: number;
  imposte: number;
  /** Fund left over from previous years (set aside minus taxes paid), since TAX_FUND_START_YEAR. */
  carriedOver: number;
  total: number;
}

/** One year's provision minus that year's taxes paid, without anything carried over. */
async function getYearTaxFund(userId: string, year: number) {
  const change = TAX_REGIME_CHANGES[year];
  const [taxedRevenue, imposte] = await Promise.all([
    getFatturatoAnnuale(userId, year, change ? change.fixedUntilMonth + 1 : 1),
    getImposteAnnuali(userId, year),
  ]);
  const fixedAmount = change?.fixedAmount ?? 0;
  return {
    fixedAmount,
    fixedUntilMonth: change?.fixedUntilMonth ?? null,
    taxedRevenue,
    imposte,
    net: fixedAmount + taxedRevenue * TAX_RATE - imposte,
  };
}

/**
 * Fondo Tasse = 23% del fatturato - imposte già pagate nell'anno, più quanto avanzato dagli
 * anni precedenti; negli anni con cambio di regime il 23% vale solo dal mese successivo e
 * prima si usa l'importo fisso.
 */
export async function getFondoTasseBreakdown(
  userId: string,
  year: number
): Promise<FondoTasseBreakdown> {
  const previousYears = Array.from(
    { length: Math.max(year - TAX_FUND_START_YEAR, 0) },
    (_, i) => TAX_FUND_START_YEAR + i
  );
  // One small query pair per year since the start — a handful of years, not driven by row count.
  const [current, ...previous] = await Promise.all([
    getYearTaxFund(userId, year),
    ...previousYears.map((y) => getYearTaxFund(userId, y)),
  ]);
  const carriedOver = previous.reduce((sum, p) => sum + p.net, 0);
  return {
    fixedAmount: current.fixedAmount,
    fixedUntilMonth: current.fixedUntilMonth,
    taxedRevenue: current.taxedRevenue,
    imposte: current.imposte,
    carriedOver,
    total: current.net + carriedOver,
  };
}

export async function getFondoTasse(
  userId: string,
  year: number
): Promise<number> {
  return (await getFondoTasseBreakdown(userId, year)).total;
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
    .select({
      id: financeAccounts.id,
      openingBalance: financeAccounts.openingBalance,
    })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        eq(financeAccounts.isSavingsAccount, false)
      )
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
    .where(
      and(
        inArray(transactions.accountId, accountIds),
        lt(transactions.date, cutoffDate)
      )
    );

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
