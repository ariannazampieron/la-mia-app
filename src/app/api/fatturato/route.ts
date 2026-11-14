import { db } from "@/lib/db";
import { categories, taxDueAmounts, transactions } from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  getFatturatoAnnuale,
  getFondoTasse,
  getImposteAnnuali,
} from "@/lib/finance/calculations";
import { computeTaxCoverage } from "@/lib/finance/taxes";
import {
  estimateNextYearTaxes,
  TAX_YEAR_PARAMS,
} from "@/lib/finance/tax-estimate";

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
  // Taxes: the current calendar year and the next one, regardless of the year shown.
  const taxYears = [new Date().getFullYear(), new Date().getFullYear() + 1];

  const [
    currentYearRevenue,
    clientCategories,
    revenueRows,
    dueRows,
    fund,
    ...paid
  ] = await Promise.all([
    getFatturatoAnnuale(userId, taxYears[0]),
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
    db
      .select({ year: taxDueAmounts.year, amount: taxDueAmounts.amount })
      .from(taxDueAmounts)
      .where(
        and(
          eq(taxDueAmounts.userId, userId),
          inArray(taxDueAmounts.year, taxYears)
        )
      ),
    getFondoTasse(userId, taxYears[0]),
    ...taxYears.map((y) => getImposteAnnuali(userId, y)),
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

  const dueByYear = new Map(dueRows.map((r) => [r.year, Number(r.amount)]));
  // Next year's taxes are estimated from this year's revenue when its parameters are known;
  // otherwise (and always for the current year) the total due is the one entered by hand.
  const params = TAX_YEAR_PARAMS[taxYears[0]];
  const estimate = params
    ? estimateNextYearTaxes(currentYearRevenue, taxYears[0], params)
    : null;
  const taxes = computeTaxCoverage(fund, [
    {
      year: taxYears[0],
      due: dueByYear.get(taxYears[0]) ?? null,
      paid: paid[0],
    },
    estimate
      ? {
          year: taxYears[1],
          due: estimate.total,
          paid: paid[1],
          estimate: estimate.lines,
        }
      : {
          year: taxYears[1],
          due: dueByYear.get(taxYears[1]) ?? null,
          paid: paid[1],
        },
  ]);

  return apiResponse({ year, months, total, clients, fondoTasse: fund, taxes });
}
