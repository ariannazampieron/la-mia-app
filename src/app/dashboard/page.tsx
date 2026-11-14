import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { financeAccounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  getAccountBalance,
  getFatturatoAnnuale,
  getImposteAnnuali,
  getFondoTasseBreakdown,
  getRisparmio,
  getLiquiditaDisponibile,
  TAX_RATE,
} from "@/lib/finance/calculations";
import { IndicatorCard } from "@/components/finance/indicator-card";
import { EditableAmount } from "@/components/finance/editable-amount";
import { getPatrimonio } from "@/lib/finance/patrimonio";
import { getTaxOverview } from "@/lib/finance/tax-overview";

/** Short Italian month name ("ott", "nov") for a 1-based month. */
function monthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString("it-IT", {
    month: "short",
  });
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.user.id;
  const year = new Date().getFullYear();

  const [savingsAccount] = await db
    .select({ id: financeAccounts.id, name: financeAccounts.name })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        eq(financeAccounts.isSavingsAccount, true)
      )
    )
    .limit(1);

  const [
    fatturato,
    imposte,
    fondo,
    risparmio,
    liquidita,
    savingsBalance,
    patrimonio,
    taxOverview,
  ] = await Promise.all([
    getFatturatoAnnuale(userId, year),
    getImposteAnnuali(userId, year),
    getFondoTasseBreakdown(userId, year),
    getRisparmio(userId, year),
    getLiquiditaDisponibile(userId),
    savingsAccount ? getAccountBalance(savingsAccount.id) : Promise.resolve(0),
    getPatrimonio(userId),
    getTaxOverview(userId),
  ]);

  // Taxes accrued so far: what's left for this year plus next year's estimate to date.
  const tasseDaPagare = taxOverview.taxes.reduce(
    (sum, t) => sum + t.remaining,
    0
  );
  const disponibilitaLiquida =
    risparmio + fondo.total + liquidita - tasseDaPagare;
  const pensionSince = new Date(patrimonio.pensionFundSince).toLocaleDateString(
    "it-IT",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  const fondoTasse = fondo.total;
  const fondoTasseRows =
    fondo.fixedUntilMonth === null
      ? [
          {
            label: "Fatturato annuale (23%)",
            value: fondo.taxedRevenue * TAX_RATE,
          },
        ]
      : [
          {
            label: `Accantonamento gen–${monthName(fondo.fixedUntilMonth)} (regime precedente)`,
            value: fondo.fixedAmount,
          },
          {
            label: `Fatturato da ${monthName(fondo.fixedUntilMonth + 1)} (23%)`,
            value: fondo.taxedRevenue * TAX_RATE,
          },
        ];

  const hasData =
    fatturato !== 0 || imposte !== 0 || savingsBalance !== 0 || liquidita !== 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Risparmio, fondo tasse e liquidità disponibile per il {year},
          aggiornati in automatico dalle tue transazioni.
        </p>
      </div>

      {!hasData && (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
          Importa il tuo primo estratto conto per vedere questi indicatori
          aggiornarsi automaticamente — vai su{" "}
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
            {
              label: savingsAccount?.name ?? "Conto risparmio",
              value: savingsBalance,
            },
            { label: "Fondo tasse accantonato", value: -fondoTasse },
          ]}
        />
        <IndicatorCard
          title="Fondo Tasse"
          value={fondoTasse}
          tone="sage"
          breakdown={[
            ...(fondo.carriedOver !== 0
              ? [{ label: "Residuo anni precedenti", value: fondo.carriedOver }]
              : []),
            ...fondoTasseRows,
            { label: "Imposte già pagate", value: -imposte },
          ]}
        />
        <IndicatorCard
          title="Liquidità c/c"
          value={liquidita}
          tone="sage"
          breakdown={[
            { label: "Somma conti non di risparmio", value: liquidita },
          ]}
        />
        <IndicatorCard
          title="Tasse da pagare"
          value={tasseDaPagare}
          tone="sage"
          breakdown={taxOverview.taxes.map((t) => ({
            label: t.estimate
              ? `${t.year} (stima maturata a oggi)`
              : t.due === null
                ? `${t.year} (totale non inserito)`
                : `Ancora da pagare ${t.year}`,
            value: t.remaining,
          }))}
        />
        <IndicatorCard
          title="Patrimonio"
          value={patrimonio.total}
          tone="sage"
          breakdown={[
            {
              label: "Casa",
              value: patrimonio.houseValue,
              valueNode: (
                <EditableAmount
                  value={patrimonio.houseValue}
                  field="houseValue"
                />
              ),
            },
            { label: "Fondo pensione", value: patrimonio.pensionFund },
            {
              label: `di cui valore iniziale (+ versamenti dal ${pensionSince})`,
              value: patrimonio.pensionFundBase,
              valueNode: (
                <EditableAmount
                  value={patrimonio.pensionFundBase}
                  field="pensionFundBase"
                />
              ),
            },
            {
              label: "Investimenti",
              value: patrimonio.investmentsValue,
              valueNode: (
                <EditableAmount
                  value={patrimonio.investmentsValue}
                  field="investmentsValue"
                />
              ),
            },
          ]}
        />
        <IndicatorCard
          title="Disponibilità"
          value={disponibilitaLiquida + patrimonio.total}
          tone="sage"
          breakdown={[
            { label: "Liquida", value: disponibilitaLiquida },
            { label: "Bloccata (patrimonio)", value: patrimonio.total },
          ]}
        />
      </div>
    </div>
  );
}
