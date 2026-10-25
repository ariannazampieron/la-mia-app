import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { applyRateLimit, requireApiAuth, apiResponse, apiError } from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getLiquidityAsOf } from "@/lib/finance/calculations";
import type { MonthBalance } from "@/app/api/budget/route";

export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-actuals", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year)) return apiError("Parametro year non valido", 400);

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
    .groupBy(transactions.categoryId, sql`extract(month from ${transactions.date})`);

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

  // Real opening liquidity at the start of each month — one query per cutoff date,
  // but there are always exactly 12, a fixed small number, not driven by row count.
  const balances: MonthBalance[] = [];
  for (let month = 1; month <= 12; month++) {
    const cutoff = `${year}-${String(month).padStart(2, "0")}-01`;
    const opening = await getLiquidityAsOf(userId, cutoff);
    const flow = cashflowByMonth.get(month) ?? { revenue: 0, cost: 0 };
    const cashFlow = flow.revenue - flow.cost;
    balances.push({
      month,
      opening,
      closing: opening + cashFlow,
      revenueTotal: flow.revenue,
      costTotal: flow.cost,
      cashFlow,
    });
  }

  return apiResponse({ actuals: rows, balances });
}
