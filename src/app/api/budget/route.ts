import { z } from "zod";
import { db } from "@/lib/db";
import { budgetEntries, budgetOpeningBalance, categories } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ensureCategoriesSeeded } from "@/lib/finance/categories";

export interface MonthBalance {
  month: number;
  opening: number;
  closing: number;
  revenueTotal: number;
  costTotal: number;
  cashFlow: number;
}

function periodKey(year: number, month: number) {
  return year * 12 + (month - 1);
}

export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-list", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year)) return apiError("Parametro year non valido", 400);

  await ensureCategoriesSeeded(session.user.id);
  const userId = session.user.id;

  const entries = await db
    .select({
      categoryId: budgetEntries.categoryId,
      month: budgetEntries.month,
      plannedAmount: budgetEntries.plannedAmount,
    })
    .from(budgetEntries)
    .where(and(eq(budgetEntries.userId, userId), eq(budgetEntries.year, year)));

  // Cashflow per year-month across ALL years (needed to cascade the projected balance
  // forward from whichever period was last manually set), grouped by category type.
  const allPlanned = await db
    .select({
      year: budgetEntries.year,
      month: budgetEntries.month,
      type: categories.type,
      total: sql<string>`coalesce(sum(${budgetEntries.plannedAmount}), 0)`,
    })
    .from(budgetEntries)
    .innerJoin(categories, eq(budgetEntries.categoryId, categories.id))
    .where(eq(budgetEntries.userId, userId))
    .groupBy(budgetEntries.year, budgetEntries.month, categories.type);

  const overrides = await db
    .select({
      year: budgetOpeningBalance.year,
      month: budgetOpeningBalance.month,
      amount: budgetOpeningBalance.amount,
    })
    .from(budgetOpeningBalance)
    .where(eq(budgetOpeningBalance.userId, userId));

  const cashflowByPeriod = new Map<number, { revenue: number; cost: number }>();
  for (const row of allPlanned) {
    const key = periodKey(row.year, row.month);
    const existing = cashflowByPeriod.get(key) ?? { revenue: 0, cost: 0 };
    if (row.type === "income") existing.revenue += Number(row.total);
    else existing.cost += Number(row.total);
    cashflowByPeriod.set(key, existing);
  }

  const overrideByPeriod = new Map<number, number>(
    overrides.map((o) => [periodKey(o.year, o.month), Number(o.amount)])
  );

  const periodsWithData = [
    ...cashflowByPeriod.keys(),
    ...overrideByPeriod.keys(),
  ];
  const targetEndKey = periodKey(year, 12);
  // Never start later than January of the target year, even if the earliest data
  // point happens to fall mid-year — otherwise earlier months of `year` would be
  // skipped entirely instead of showing a zeroed opening/closing balance.
  const startKey = Math.min(periodKey(year, 1), ...periodsWithData);

  let runningOpening = 0;
  const balances: MonthBalance[] = [];
  for (let key = startKey; key <= targetEndKey; key++) {
    const keyYear = Math.floor(key / 12);
    const keyMonth = (key % 12) + 1;
    const opening = overrideByPeriod.has(key) ? overrideByPeriod.get(key)! : runningOpening;
    const flow = cashflowByPeriod.get(key) ?? { revenue: 0, cost: 0 };
    const cashFlow = flow.revenue - flow.cost;
    const closing = opening + cashFlow;
    runningOpening = closing;

    if (keyYear === year) {
      balances.push({
        month: keyMonth,
        opening,
        closing,
        revenueTotal: flow.revenue,
        costTotal: flow.cost,
        cashFlow,
      });
    }
  }

  return apiResponse({ entries, balances });
}

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  plannedAmount: z.coerce.number().min(0),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("budget-upsert", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, upsertSchema);
  if (parseErr) return parseErr;

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.id, data.categoryId), eq(categories.userId, session.user.id))
    )
    .limit(1);
  if (!category) return apiError("Categoria non trovata", 404);

  await db
    .insert(budgetEntries)
    .values({
      userId: session.user.id,
      year: data.year,
      month: data.month,
      categoryId: data.categoryId,
      plannedAmount: data.plannedAmount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [
        budgetEntries.userId,
        budgetEntries.year,
        budgetEntries.month,
        budgetEntries.categoryId,
      ],
      set: { plannedAmount: data.plannedAmount.toFixed(2) },
    });

  return apiResponse({ ok: true });
}
