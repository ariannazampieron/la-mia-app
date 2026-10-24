import { z } from "zod";
import { db } from "@/lib/db";
import { budgetEntries, categories } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ensureCategoriesSeeded } from "@/lib/finance/categories";

export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-list", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year)) return apiError("Parametro year non valido", 400);

  await ensureCategoriesSeeded(session.user.id);

  const entries = await db
    .select({
      categoryId: budgetEntries.categoryId,
      month: budgetEntries.month,
      plannedAmount: budgetEntries.plannedAmount,
    })
    .from(budgetEntries)
    .where(and(eq(budgetEntries.userId, session.user.id), eq(budgetEntries.year, year)));

  return apiResponse({ entries });
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
