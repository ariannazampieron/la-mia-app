import { z } from "zod";
import { db } from "@/lib/db";
import { transactions, financeAccounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const updateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string().date().optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.coerce.number().positive().optional(),
  type: z.enum(["income", "expense"]).optional(),
  isInternalTransfer: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await applyRateLimit("transactions-update", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const { data, error: parseErr } = await parseBody(req, updateTransactionSchema);
  if (parseErr) return parseErr;

  if (data.accountId) {
    const [account] = await db
      .select({ id: financeAccounts.id })
      .from(financeAccounts)
      .where(
        and(
          eq(financeAccounts.id, data.accountId),
          eq(financeAccounts.userId, session.user.id)
        )
      )
      .limit(1);
    if (!account) return apiError("Conto non trovato", 404);
  }

  const [updated] = await db
    .update(transactions)
    .set({
      ...(data.accountId && { accountId: data.accountId }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.date && { date: data.date }),
      ...(data.description && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount.toFixed(2) }),
      ...(data.type && { type: data.type }),
      ...(data.isInternalTransfer !== undefined && {
        isInternalTransfer: data.isInternalTransfer,
      }),
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)))
    .returning({ id: transactions.id });

  if (!updated) return apiError("Transazione non trovata", 404);

  return apiResponse({ id: updated.id });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await applyRateLimit("transactions-delete", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  const [deleted] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)))
    .returning({ id: transactions.id });

  if (!deleted) return apiError("Transazione non trovata", 404);

  return apiResponse({ id: deleted.id });
}
