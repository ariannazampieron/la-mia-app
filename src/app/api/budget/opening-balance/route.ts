import { z } from "zod";
import { db } from "@/lib/db";
import { budgetOpeningBalance } from "@/lib/schema";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.coerce.number(),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("budget-opening-balance-upsert", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, upsertSchema);
  if (parseErr) return parseErr;

  await db
    .insert(budgetOpeningBalance)
    .values({
      userId: session.user.id,
      year: data.year,
      month: data.month,
      amount: data.amount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [
        budgetOpeningBalance.userId,
        budgetOpeningBalance.year,
        budgetOpeningBalance.month,
      ],
      set: { amount: data.amount.toFixed(2) },
    });

  return apiResponse({ ok: true });
}
