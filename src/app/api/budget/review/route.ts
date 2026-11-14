import { z } from "zod";
import { db } from "@/lib/db";
import { budgetReviewEntries, categories } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getLastStatementImportDate } from "@/lib/finance/user-settings";

/**
 * Last month of `year` fully covered by the statements, from the last import date entered
 * in Transazioni: a month is closed once the import date reaches its last day.
 */
function closedThroughMonth(year: number, importDate: string | null): number {
  if (!importDate) return 0;
  const [importYear, importMonth, importDay] = importDate
    .split("-")
    .map(Number);
  if (importYear > year) return 12;
  if (importYear < year) return 0;
  const lastDay = new Date(Date.UTC(importYear, importMonth, 0)).getUTCDate();
  return importDay === lastDay ? importMonth : importMonth - 1;
}

export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-review", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year))
    return apiError("Parametro year non valido", 400);

  const [entries, importDate] = await Promise.all([
    db
      .select({
        categoryId: budgetReviewEntries.categoryId,
        month: budgetReviewEntries.month,
        amount: budgetReviewEntries.amount,
      })
      .from(budgetReviewEntries)
      .where(
        and(
          eq(budgetReviewEntries.userId, session.user.id),
          eq(budgetReviewEntries.year, year)
        )
      ),
    getLastStatementImportDate(session.user.id),
  ]);

  return apiResponse({
    entries,
    closedThroughMonth: closedThroughMonth(year, importDate),
  });
}

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  amount: z.coerce.number().min(0),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("budget-review-upsert", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, upsertSchema);
  if (parseErr) return parseErr;

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, data.categoryId),
        eq(categories.userId, session.user.id)
      )
    )
    .limit(1);
  if (!category) return apiError("Categoria non trovata", 404);

  await db
    .insert(budgetReviewEntries)
    .values({
      userId: session.user.id,
      year: data.year,
      month: data.month,
      categoryId: data.categoryId,
      amount: data.amount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [
        budgetReviewEntries.userId,
        budgetReviewEntries.year,
        budgetReviewEntries.month,
        budgetReviewEntries.categoryId,
      ],
      set: { amount: data.amount.toFixed(2) },
    });

  return apiResponse({ ok: true });
}
