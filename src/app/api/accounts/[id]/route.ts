import { z } from "zod";
import { db } from "@/lib/db";
import { financeAccounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const updateAccountSchema = z.object({
  openingBalance: z.coerce.number().finite(),
  openingBalanceDate: z.string().date(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await applyRateLimit("accounts-update", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const { data, error: parseErr } = await parseBody(req, updateAccountSchema);
  if (parseErr) return parseErr;

  const [updated] = await db
    .update(financeAccounts)
    .set({
      openingBalance: data.openingBalance.toFixed(2),
      openingBalanceDate: data.openingBalanceDate,
    })
    .where(
      and(
        eq(financeAccounts.id, id),
        eq(financeAccounts.userId, session.user.id)
      )
    )
    .returning({ id: financeAccounts.id });

  if (!updated) return apiError("Conto non trovato", 404);

  return apiResponse({ id: updated.id });
}
