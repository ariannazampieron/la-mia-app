import { z } from "zod";
import { db } from "@/lib/db";
import { taxDueAmounts } from "@/lib/schema";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  amount: z.coerce.number().min(0),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("tax-due-upsert", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, upsertSchema);
  if (parseErr) return parseErr;

  await db
    .insert(taxDueAmounts)
    .values({
      userId: session.user.id,
      year: data.year,
      amount: data.amount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [taxDueAmounts.userId, taxDueAmounts.year],
      set: { amount: data.amount.toFixed(2) },
    });

  return apiResponse({ ok: true });
}
