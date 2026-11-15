import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

/** Expense categories that are money put aside, not spending (the old monthly 300 € set-aside). */
const SAVINGS_EXPENSE_CATEGORIES = ["ACCANTONAMENTO"];

/**
 * One-off incomes that are only money moved back from elsewhere, not earnings: in April 2026
 * the fund the monthly set-aside went into was transferred in, recorded as ALTRO.
 */
const ONE_OFF_TRANSFERS_IN = [
  { year: 2026, month: 4, category: "ALTRO", amount: 10317.82 },
];

export interface MonthlySaved {
  month: number;
  income: number;
  expenses: number;
  /** income - expenses: what was really left that month. */
  saved: number;
}

/**
 * What was really saved each month: Rendiconto income minus expenses (categorized, not
 * internal), leaving out set-asides counted as expenses and transfers counted as income.
 */
export async function getMonthlySaved(
  userId: string,
  year: number,
  monthsCount: number
): Promise<MonthlySaved[]> {
  const monthExpr = sql<number>`extract(month from ${transactions.date})::int`;
  const base = and(
    eq(transactions.userId, userId),
    eq(transactions.isInternalTransfer, false),
    sql`extract(year from ${transactions.date}) = ${year}`
  );
  const transfers = ONE_OFF_TRANSFERS_IN.filter((t) => t.year === year);

  const [totals, transferRows] = await Promise.all([
    db
      .select({
        month: monthExpr,
        type: transactions.type,
        category: categories.name,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(base)
      .groupBy(
        sql`extract(month from ${transactions.date})`,
        transactions.type,
        categories.name
      ),
    transfers.length > 0
      ? db
          .select({
            month: monthExpr,
            category: categories.name,
            amount: transactions.amount,
          })
          .from(transactions)
          .innerJoin(categories, eq(transactions.categoryId, categories.id))
          .where(
            and(
              base,
              eq(transactions.type, "income"),
              inArray(
                categories.name,
                transfers.map((t) => t.category)
              ),
              inArray(
                transactions.amount,
                transfers.map((t) => t.amount.toFixed(2))
              )
            )
          )
          .limit(50)
      : Promise.resolve([]),
  ]);

  // Only the transfers actually found, in the month and category expected.
  const excludedIncome = new Map<number, number>();
  for (const row of transferRows) {
    if (
      transfers.some(
        (t) =>
          t.month === row.month &&
          t.category === row.category &&
          Math.abs(Number(row.amount) - t.amount) < 0.005
      )
    ) {
      excludedIncome.set(
        row.month,
        (excludedIncome.get(row.month) ?? 0) + Number(row.amount)
      );
    }
  }

  return Array.from({ length: monthsCount }, (_, i) => {
    const month = i + 1;
    const inMonth = totals.filter((r) => r.month === month);
    const income =
      inMonth
        .filter((r) => r.type === "income")
        .reduce((sum, r) => sum + Number(r.total), 0) -
      (excludedIncome.get(month) ?? 0);
    const expenses = inMonth
      .filter(
        (r) =>
          r.type === "expense" &&
          !SAVINGS_EXPENSE_CATEGORIES.includes(r.category)
      )
      .reduce((sum, r) => sum + Number(r.total), 0);
    return { month, income, expenses, saved: income - expenses };
  });
}
