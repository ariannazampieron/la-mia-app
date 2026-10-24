import { db } from "@/lib/db";
import { financeAccounts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { applyRateLimit, requireApiAuth, apiResponse } from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ensureAccountsSeeded } from "@/lib/finance/accounts-seed";
import { getAccountBalance } from "@/lib/finance/calculations";

export async function GET() {
  const limited = await applyRateLimit("accounts-list", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  await ensureAccountsSeeded(session.user.id);

  const rows = await db
    .select({
      id: financeAccounts.id,
      name: financeAccounts.name,
      isSavingsAccount: financeAccounts.isSavingsAccount,
      openingBalance: financeAccounts.openingBalance,
      openingBalanceDate: financeAccounts.openingBalanceDate,
    })
    .from(financeAccounts)
    .where(eq(financeAccounts.userId, session.user.id));

  const accounts = await Promise.all(
    rows.map(async (account) => ({
      ...account,
      currentBalance: await getAccountBalance(account.id),
    }))
  );

  return apiResponse({ accounts });
}
