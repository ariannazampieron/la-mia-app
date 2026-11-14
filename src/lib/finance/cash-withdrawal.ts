import { db } from "@/lib/db";
import { financeAccounts, transactions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { CASH_ACCOUNT_NAME } from "@/lib/finance/cash-account";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findCashAccountId(
  userId: string
): Promise<string | null> {
  const [account] = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        eq(financeAccounts.name, CASH_ACCOUNT_NAME)
      )
    )
    .limit(1);
  return account?.id ?? null;
}

export interface WithdrawalSource {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  source: "import" | "manual";
  importBatchId?: string | null;
}

/** The internal income on "Contanti" that mirrors a cash withdrawal from a bank account. */
export function cashMirrorValues(
  userId: string,
  cashAccountId: string,
  w: WithdrawalSource
) {
  return {
    userId,
    accountId: cashAccountId,
    categoryId: null,
    date: w.date,
    description: `Prelievo da ${w.accountName}: ${w.description}`,
    amount: w.amount,
    type: "income" as const,
    isInternalTransfer: true,
    source: w.source,
    importBatchId: w.importBatchId ?? null,
    cashSourceId: w.id,
  };
}

/**
 * Makes the "Contanti" mirror of a transaction match its current state: created or updated
 * when it's flagged as a withdrawal (an expense on another account), removed otherwise.
 */
export async function syncCashMirror(
  tx: DbTransaction,
  userId: string,
  cashAccountId: string,
  w: WithdrawalSource,
  isWithdrawal: boolean
) {
  const shouldMirror =
    isWithdrawal && w.type === "expense" && w.accountId !== cashAccountId;
  if (!shouldMirror) {
    await tx.delete(transactions).where(eq(transactions.cashSourceId, w.id));
    return;
  }

  const values = cashMirrorValues(userId, cashAccountId, w);
  const [existing] = await tx
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.cashSourceId, w.id))
    .limit(1);
  if (existing) {
    await tx
      .update(transactions)
      .set({
        date: values.date,
        description: values.description,
        amount: values.amount,
      })
      .where(eq(transactions.id, existing.id));
  } else {
    await tx.insert(transactions).values(values);
  }
}
