import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { financeAccounts, transactions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isCashWithdrawal, isInternalMovement } from "@/lib/finance/categorize";
import { CASH_ACCOUNT_NAME } from "@/lib/finance/cash-account";
import {
  cashMirrorValues,
  findCashAccountId,
} from "@/lib/finance/cash-withdrawal";

const confirmRowSchema = z.object({
  date: z.string().date(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid().nullable(),
  // Optional so a client that doesn't send it (e.g. a tab opened before a deploy)
  // still gets transfers/withdrawals detected from the description.
  isInternalTransfer: z.boolean().optional(),
  isCashWithdrawal: z.boolean().optional(),
});

const confirmSchema = z.object({
  accountId: z.string().uuid(),
  rows: z.array(confirmRowSchema).min(1).max(1000),
});

export async function POST(req: Request) {
  const limited = await applyRateLimit(
    "transactions-import-confirm",
    RATE_LIMITS.api
  );
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, confirmSchema);
  if (parseErr) return parseErr;

  const [account] = await db
    .select({ id: financeAccounts.id, name: financeAccounts.name })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.id, data.accountId),
        eq(financeAccounts.userId, session.user.id)
      )
    )
    .limit(1);
  if (!account) return apiError("Conto non trovato", 404);

  const importBatchId = randomUUID();
  const rows = data.rows.map((row) => {
    const withdrawal =
      row.type === "expense" &&
      (row.isCashWithdrawal ?? isCashWithdrawal(row.description, row.type));
    return {
      ...row,
      // Generated up front so each withdrawal's "Contanti" mirror can point back to it.
      id: randomUUID(),
      withdrawal,
      // A withdrawal is always internal: the real spending is tracked on "Contanti".
      internal:
        withdrawal ||
        (row.isInternalTransfer ?? isInternalMovement(row.description)),
    };
  });

  // Withdrawals from a bank account reappear as income on the cash account.
  const withdrawals =
    account.name === CASH_ACCOUNT_NAME ? [] : rows.filter((r) => r.withdrawal);
  const cashAccountId =
    withdrawals.length > 0 ? await findCashAccountId(session.user.id) : null;
  if (withdrawals.length > 0 && !cashAccountId) {
    return apiError(
      `Conto "${CASH_ACCOUNT_NAME}" non trovato: serve per registrare i prelievi.`,
      422
    );
  }

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values(
      rows.map((row) => ({
        id: row.id,
        userId: session.user.id,
        accountId: data.accountId,
        categoryId: row.withdrawal ? null : row.categoryId,
        date: row.date,
        description: row.description,
        amount: row.amount.toFixed(2),
        type: row.type,
        isInternalTransfer: row.internal,
        source: "import" as const,
        importBatchId,
      }))
    );

    if (cashAccountId) {
      await tx.insert(transactions).values(
        withdrawals.map((row) =>
          cashMirrorValues(session.user.id, cashAccountId, {
            id: row.id,
            accountId: data.accountId,
            accountName: account.name,
            date: row.date,
            description: row.description,
            amount: row.amount.toFixed(2),
            type: row.type,
            source: "import",
            importBatchId,
          })
        )
      );
    }
  });

  return apiResponse({
    imported: data.rows.length,
    cashWithdrawals: withdrawals.length,
    importBatchId,
  });
}
