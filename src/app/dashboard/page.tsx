import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { financeAccounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  getAccountBalance,
  getFatturatoAnnuale,
  getImposteAnnuali,
  getFondoTasse,
  getRisparmio,
  getLiquiditaDisponibile,
} from "@/lib/finance/calculations";
import { IndicatorCard } from "@/components/finance/indicator-card";

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.user.id;
  const year = new Date().getFullYear();

  const [savingsAccount] = await db
    .select({ id: financeAccounts.id, name: financeAccounts.name })
    .from(financeAccounts)
    .where(
      and(eq(financeAccounts.userId, userId), eq(financeAccounts.isSavingsAccount, true))
    )
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

  const hasData = fatturato !== 0 || imposte !== 0 || savingsBalance !== 0 || liquidita !== 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Risparmio, fondo tasse e liquidità disponibile per il {year}, aggiornati in
          automatico dalle tue transazioni.
        </p>
      </div>

      {!hasData && (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Importa il tuo primo estratto conto per vedere questi indicatori aggiornarsi
          automaticamente — vai su{" "}
          <Link
            href="/dashboard/transactions"
            className="text-primary underline underline-offset-4"
          >
            Transazioni
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <IndicatorCard
          title="Risparmio"
          value={risparmio}
          tone="sage"
          percentage={fatturato > 0 ? (risparmio / fatturato) * 100 : 0}
          percentageLabel="Tasso di risparmio sul fatturato"
          breakdown={[
            { label: savingsAccount?.name ?? "Conto risparmio", value: savingsBalance },
            { label: "Fondo tasse accantonato", value: -fondoTasse },
          ]}
        />
        <IndicatorCard
          title="Fondo Tasse"
          value={fondoTasse}
          tone="sage"
          breakdown={[
            { label: "Fatturato annuale (23%)", value: fatturato * 0.23 },
            { label: "Imposte già pagate", value: -imposte },
          ]}
        />
        <IndicatorCard
          title="Liquidità disponibile"
          value={liquidita}
          tone="sage"
          breakdown={[{ label: "Somma conti non di risparmio", value: liquidita }]}
        />
      </div>
    </div>
  );
}
