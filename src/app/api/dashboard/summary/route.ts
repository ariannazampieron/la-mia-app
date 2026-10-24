import { db } from "@/lib/db";
import { financeAccounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { applyRateLimit, requireApiAuth, apiResponse } from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  getAccountBalance,
  getFatturatoAnnuale,
  getImposteAnnuali,
  getFondoTasse,
  getRisparmio,
  getLiquiditaDisponibile,
} from "@/lib/finance/calculations";

export async function GET() {
  const limited = await applyRateLimit("dashboard-summary", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const year = new Date().getFullYear();
  const userId = session.user.id;

  const [savingsAccount] = await db
    .select({ id: financeAccounts.id, name: financeAccounts.name })
    .from(financeAccounts)
    .where(and(eq(financeAccounts.userId, userId), eq(financeAccounts.isSavingsAccount, true)))
    .limit(1);

  const [fatturato, imposte, fondoTasse, risparmio, liquidita, savingsBalance] =
    await Promise.all([
      getFatturatoAnnuale(userId, year),
      getImposteAnnuali(userId, year),
      getFondoTasse(userId, year),
      getRisparmio(userId, year),
      getLiquiditaDisponibile(userId),
      savingsAccount ? getAccountBalance(savingsAccount.id) : Promise.resolve(0),
    ]);

  return apiResponse({
    year,
    risparmio,
    fondoTasse,
    liquiditaDisponibile: liquidita,
    breakdown: {
      savingsAccountName: savingsAccount?.name ?? null,
      savingsAccountBalance: savingsBalance,
      fatturatoAnnuale: fatturato,
      imposteAnnuali: imposte,
    },
  });
}
