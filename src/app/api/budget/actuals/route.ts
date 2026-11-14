import { db } from "@/lib/db";
import { transactions, categories, financeAccounts } from "@/lib/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { MonthBalance } from "@/app/api/budget/route";

export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-actuals", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year))
    return apiError("Parametro year non valido", 400);

  const userId = session.user.id;

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      month: sql<number>`extract(month from ${transactions.date})::int`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isInternalTransfer, false),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    )
    .groupBy(
      transactions.categoryId,
      sql`extract(month from ${transactions.date})`
    );

  const typeRows = await db
    .select({
      month: sql<number>`extract(month from ${transactions.date})::int`,
      type: categories.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isInternalTransfer, false),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    )
    .groupBy(sql`extract(month from ${transactions.date})`, categories.type);

  const cashflowByMonth = new Map<number, { revenue: number; cost: number }>();
  for (const row of typeRows) {
    const existing = cashflowByMonth.get(row.month) ?? { revenue: 0, cost: 0 };
    if (row.type === "income") existing.revenue += Number(row.total);
    else existing.cost += Number(row.total);
    cashflowByMonth.set(row.month, existing);
  }

  // Balances cover ALL accounts, like the Conti page, and chain month to month: each
  // month opens where the previous one closed. Internal transfers and uncategorized rows
  // move the balance without being revenue or cost: they're the "otherMovements".
  const signedAmount = sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`;
  const [[accountsRow], [beforeYearRow], netRows] = await Promise.all([
    db
      .select({
        total: sql<string>`coalesce(sum(${financeAccounts.openingBalance}), 0)`,
      })
      .from(financeAccounts)
      .where(eq(financeAccounts.userId, userId)),
    db
      .select({ total: signedAmount })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          lt(transactions.date, `${year}-01-01`)
        )
      ),
    db
      .select({
        month: sql<number>`extract(month from ${transactions.date})::int`,
        total: signedAmount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`extract(year from ${transactions.date}) = ${year}`
        )
      )
      .groupBy(sql`extract(month from ${transactions.date})`),
  ]);
  const netByMonth = new Map(netRows.map((r) => [r.month, Number(r.total)]));

  let opening =
    Number(accountsRow?.total ?? 0) + Number(beforeYearRow?.total ?? 0);
  const balances: MonthBalance[] = [];
  for (let month = 1; month <= 12; month++) {
    const flow = cashflowByMonth.get(month) ?? { revenue: 0, cost: 0 };
    const cashFlow = flow.revenue - flow.cost;
    const net = netByMonth.get(month) ?? 0;
    const closing = opening + net;
    balances.push({
      month,
      opening,
      closing,
      revenueTotal: flow.revenue,
      costTotal: flow.cost,
      cashFlow,
      otherMovements: net - cashFlow,
    });
    opening = closing;
  }

  return apiResponse({ actuals: rows, balances });
}
