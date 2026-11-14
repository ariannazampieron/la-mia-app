import { db } from "@/lib/db";
import { financeAccounts } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const FIXED_ACCOUNT_NAMES = [
  "BBVA",
  "BCC",
  "Paypal",
  "Contanti",
  "Conto Arancio",
  "Conto Arancio Deposito",
] as const;

export const SAVINGS_ACCOUNT_NAME = "Conto Arancio Deposito";

/** Seeds the fixed list of accounts for a user if they don't have any yet. */
export async function ensureAccountsSeeded(userId: string) {
  const existing = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(eq(financeAccounts.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(financeAccounts).values(
    FIXED_ACCOUNT_NAMES.map((name) => ({
      userId,
      name,
      isSavingsAccount: name === SAVINGS_ACCOUNT_NAME,
      openingBalance: "0",
    }))
  );
}
