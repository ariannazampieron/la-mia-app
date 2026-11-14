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
import {
  findCashAccountId,
  syncCashMirror,
} from "@/lib/finance/cash-withdrawal";

const updateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string().date().optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.coerce.number().positive().optional(),
  type: z.enum(["income", "expense"]).optional(),
  isInternalTransfer: z.boolean().optional(),
  isCashWithdrawal: z.boolean().optional(),
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
  const { data, error: parseErr } = await parseBody(
    req,
    updateTransactionSchema
  );
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

  // When not sent, keep the current state: an existing mirror stays and follows the edit.
  const [existingMirror] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.cashSourceId, id),
        eq(transactions.userId, session.user.id)
      )
    )
    .limit(1);
  const isWithdrawal = data.isCashWithdrawal ?? Boolean(existingMirror);
  const cashAccountId =
    isWithdrawal || existingMirror
      ? await findCashAccountId(session.user.id)
      : null;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
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
        // A withdrawal is always internal: the real spending is tracked on "Contanti".
        ...(data.isCashWithdrawal && { isInternalTransfer: true }),
      })
      .where(
        and(eq(transactions.id, id), eq(transactions.userId, session.user.id))
      )
      .returning({
        id: transactions.id,
        accountId: transactions.accountId,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        source: transactions.source,
      });
    if (!row) return null;

    if (cashAccountId) {
      const [account] = await tx
        .select({ name: financeAccounts.name })
        .from(financeAccounts)
        .where(eq(financeAccounts.id, row.accountId))
        .limit(1);
      await syncCashMirror(
        tx,
        session.user.id,
        cashAccountId,
        { ...row, accountName: account?.name ?? "" },
        isWithdrawal
      );
    }
    return row;
  });

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
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, session.user.id))
    )
    .returning({ id: transactions.id });

  if (!deleted) return apiError("Transazione non trovata", 404);

  return apiResponse({ id: deleted.id });
}
