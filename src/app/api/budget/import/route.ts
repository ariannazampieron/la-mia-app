import { z } from "zod";
import { db } from "@/lib/db";
import { budgetEntries, categories } from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const importSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  entries: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        month: z.number().int().min(1).max(12),
        plannedAmount: z.number().min(0),
      })
    )
    .min(1)
    .max(1000),
});

/** Bulk upsert of planned amounts for one year (used by the Excel budget import). */
export async function POST(req: Request) {
  const limited = await applyRateLimit("budget-import", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, importSchema);
  if (parseErr) return parseErr;

  const userId = session.user.id;
  const categoryIds = [...new Set(data.entries.map((e) => e.categoryId))];
  const owned = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.userId, userId), inArray(categories.id, categoryIds))
    );
  if (owned.length !== categoryIds.length)
    return apiError("Categoria non trovata", 404);

  await db
    .insert(budgetEntries)
    .values(
      data.entries.map((e) => ({
        userId,
        year: data.year,
        month: e.month,
        categoryId: e.categoryId,
        plannedAmount: e.plannedAmount.toFixed(2),
      }))
    )
    .onConflictDoUpdate({
      target: [
        budgetEntries.userId,
        budgetEntries.year,
        budgetEntries.month,
        budgetEntries.categoryId,
      ],
      set: {
        plannedAmount: sql`excluded.planned_amount`,
        updatedAt: new Date(),
      },
    });

  return apiResponse({ imported: data.entries.length });
}
