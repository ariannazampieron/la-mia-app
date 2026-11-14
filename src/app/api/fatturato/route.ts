import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getTaxOverview } from "@/lib/finance/tax-overview";

const CLIENT_PREFIX = "Clienti_";

export async function GET(req: Request) {
  const limited = await applyRateLimit("fatturato", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  if (!Number.isInteger(year))
    return apiError("Parametro year non valido", 400);

  const userId = session.user.id;

  // Taxes always refer to the current calendar year and the next one,
  // regardless of the year shown in the revenue chart.
  const [clientCategories, revenueRows, overview] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          eq(categories.isClientRevenueCategory, true)
        )
      ),
    db
      .select({
        categoryId: transactions.categoryId,
        month: sql<number>`extract(month from ${transactions.date})::int`,
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
      .groupBy(
        transactions.categoryId,
        sql`extract(month from ${transactions.date})`
      ),
    getTaxOverview(userId),
  ]);

  const months = Array.from({ length: 12 }, () => 0);
  const byCategory = new Map<string, number>();
  for (const row of revenueRows) {
    const amount = Number(row.total);
    months[row.month - 1] += amount;
    byCategory.set(
      row.categoryId!,
      (byCategory.get(row.categoryId!) ?? 0) + amount
    );
  }
  const total = months.reduce((sum, m) => sum + m, 0);

  const clients = clientCategories
    .map((c) => ({
      name: c.name.startsWith(CLIENT_PREFIX)
        ? c.name.slice(CLIENT_PREFIX.length)
        : c.name,
      total: byCategory.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  return apiResponse({ year, months, total, clients, ...overview });
}
