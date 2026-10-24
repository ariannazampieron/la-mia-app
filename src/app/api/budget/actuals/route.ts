import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { applyRateLimit, requireApiAuth, apiResponse, apiError } from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-actuals", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year)) return apiError("Parametro year non valido", 400);

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      month: sql<number>`extract(month from ${transactions.date})::int`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        eq(transactions.isInternalTransfer, false),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    )
    .groupBy(transactions.categoryId, sql`extract(month from ${transactions.date})`);

  return apiResponse({ actuals: rows });
}
