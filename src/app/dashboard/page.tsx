import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAuth } from "@/lib/session";
import {
  getFatturatoAnnuale,
  getLiquiditaDisponibile,
} from "@/lib/finance/calculations";
import { getCostAnalysis } from "@/lib/finance/cost-analysis";
import { getPatrimonio } from "@/lib/finance/patrimonio";
import { getTaxOverview } from "@/lib/finance/tax-overview";
import { getLastStatementImportDate } from "@/lib/finance/user-settings";
import { getMonthlySaved } from "@/lib/finance/monthly-savings";
import {
  computeHomeGoals,
  formatRunway,
  SAFETY_MONTHS_GOAL,
} from "@/lib/finance/scenarios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndicatorCard } from "@/components/finance/indicator-card";
import { EditableAmount } from "@/components/finance/editable-amount";
import { LastImportNote } from "@/components/finance/last-import-note";
import { GoalProgress } from "@/components/finance/goal-progress";
import { SavingsChart } from "@/components/finance/savings-chart";
import { MONTH_LABELS } from "@/lib/finance/months";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const euro = (value: number) => currencyFormatter.format(value);

/** "Al ritmo di quest'anno ci arrivi in circa N mesi", or null when there's no saving pace. */
function eta(missing: number, monthlyPace: number): string | null {
  if (missing <= 0 || monthlyPace <= 0) return null;
  const months = Math.ceil(missing / monthlyPace);
  return `Al ritmo di quest'anno (${euro(monthlyPace)}/mese) ci arrivi in circa ${months} ${months === 1 ? "mese" : "mesi"}.`;
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.user.id;
  const year = new Date().getFullYear();
  const firstName = session.user.name?.split(" ")[0];

  const [
    taxOverview,
    costAnalysis,
    fatturato,
    liquidita,
    patrimonio,
    lastImportDate,
  ] = await Promise.all([
    getTaxOverview(userId),
    getCostAnalysis(userId, year),
    getFatturatoAnnuale(userId, year),
    getLiquiditaDisponibile(userId),
    getPatrimonio(userId),
    getLastStatementImportDate(userId),
  ]);
  // Months from January to the last one with data, as in Rendiconto and Analisi costi.
  const monthsShown = Math.max(costAnalysis.monthsCount, 1);
  const savedByMonth = await getMonthlySaved(userId, year, monthsShown);

  const { savingsBalance, risparmio, fondoTasse, tasseDaPagare } = taxOverview;
  const survivalMonthly =
    costAnalysis.groups.find((g) => g.key === "sopravvivenza")
      ?.monthlyAverage ?? 0;
  const goals = computeHomeGoals({
    savingsBalance,
    risparmio,
    fondoTasse,
    tasseDaPagare,
    survivalMonthly,
  });

  const savedTotal = savedByMonth.reduce((sum, m) => sum + m.saved, 0);
  // Pace used to estimate when the goals are reached.
  const monthlyPace = savedTotal / monthsShown;
  const bestMonth = savedByMonth.reduce(
    (best, m, i) =>
      m.saved > best.total ? { index: i, total: m.saved } : best,
    { index: -1, total: 0 }
  );

  const goalsDone = [goals.safety.progress, goals.taxes.progress].filter(
    (p) => p >= 1
  ).length;
  const overallProgress =
    (Math.min(goals.safety.progress, 1) + Math.min(goals.taxes.progress, 1)) /
    2;
  const disponibilitaLiquida = savingsBalance + liquidita - tasseDaPagare;
  const hasData = savingsBalance !== 0 || liquidita !== 0 || fatturato !== 0;

  return (
    <div className="space-y-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <LastImportNote date={lastImportDate} />
      </div>

      {!hasData && (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
          Importa il tuo primo estratto conto per vedere obiettivi e indicatori
          aggiornarsi da soli — vai su{" "}
          <Link
            href="/dashboard/transactions"
            className="text-primary underline underline-offset-4"
          >
            Transazioni
          </Link>
          .
        </p>
      )}

      {/* Goals: the first thing on the page, on the one navy surface of the app. */}
      <section className="bg-navy text-navy-foreground relative overflow-hidden rounded-3xl p-6 md:p-10">
        <div
          aria-hidden
          className="bg-primary/25 pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
        />
        <div className="relative space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-primary text-[11px] font-semibold tracking-wider uppercase">
              I tuoi obiettivi
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {firstName ? `Ciao ${firstName}, ` : ""}
              {goalsDone === 2
                ? "entrambi gli obiettivi sono raggiunti."
                : goalsDone === 1
                  ? "un obiettivo è raggiunto, manca l'altro."
                  : `sei al ${Math.round(overallProgress * 100)}% del percorso.`}
            </h2>
            <p className="text-white/70">
              Prima le tasse coperte, poi {SAFETY_MONTHS_GOAL} mesi di
              tranquillità: il Conto Deposito riempie il fondo tasse e tutto
              quello che avanza diventa risparmio.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <GoalProgress
              eyebrow="Obiettivo 1"
              title={`${SAFETY_MONTHS_GOAL} mesi di sicurezza`}
              progress={goals.safety.progress}
              current={goals.safety.current}
              target={goals.safety.target}
              missing={goals.safety.missing}
              detail={`Il risparmio copre ${formatRunway(goals.safety.monthsCovered)} di spese di sopravvivenza (${euro(survivalMonthly)}/mese).`}
              eta={eta(goals.taxes.missing + goals.safety.missing, monthlyPace)}
            />
            <GoalProgress
              eyebrow="Obiettivo 2"
              title="Tasse coperte al 100%"
              progress={goals.taxes.progress}
              current={goals.taxes.current}
              target={goals.taxes.target}
              missing={goals.taxes.missing}
              detail={`Il fondo tasse copre le tasse maturate a oggi: ${taxOverview.taxes.map((t) => t.year).join(" e ")}.`}
              eta={eta(goals.taxes.missing, monthlyPace)}
            />
          </div>
        </div>
      </section>

      {/* Scenario: losing the job tomorrow. */}
      <Card className="border-l-primary border-l-4">
        <CardContent className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-3 md:w-1/3">
            <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Scenario
              </p>
              <p className="font-semibold">
                Se perdessi il lavoro domani, quanti mesi potrei andare avanti?
              </p>
            </div>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                {formatRunway(goals.jobLoss.afterTaxes)}
              </p>
              <p className="text-muted-foreground text-xs">
                Pagate le tasse: risparmio {euro(risparmio)} ÷{" "}
                {euro(survivalMonthly)}/mese
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-mono text-3xl font-bold tracking-tight tabular-nums">
                {formatRunway(goals.jobLoss.ignoringTaxes)}
              </p>
              <p className="text-muted-foreground text-xs">
                Ignorando le tasse: tutto il conto deposito{" "}
                {euro(savingsBalance)} ÷ {euro(survivalMonthly)}/mese
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Il dettaglio
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <IndicatorCard
            title="Risparmio"
            value={risparmio}
            tone="sage"
            variant="tinted"
            percentage={fatturato > 0 ? (risparmio / fatturato) * 100 : 0}
            percentageLabel="Risparmio sul fatturato dell'anno"
            breakdown={[
              {
                label: taxOverview.savingsAccountName ?? "Conto deposito",
                value: savingsBalance,
              },
              { label: "Fondo tasse", value: -fondoTasse },
            ]}
          />
          <IndicatorCard
            title="Fondo tasse"
            value={fondoTasse}
            tone="sage"
            variant="tinted"
            breakdown={[
              ...taxOverview.taxes.map((t) => ({
                label: t.estimate
                  ? `Stima ${t.year}`
                  : t.due === null
                    ? `${t.year} (da inserire)`
                    : `Residuo ${t.year}`,
                value: t.remaining,
              })),
              ...(goals.taxes.missing > 0
                ? [{ label: "Ancora da coprire", value: -goals.taxes.missing }]
                : []),
            ]}
          />
          <IndicatorCard
            title="Liquidità c/c"
            value={liquidita}
            tone="sage"
            variant="tinted"
            breakdown={[{ label: "Conti correnti", value: liquidita }]}
          />
          <IndicatorCard
            title="Patrimonio"
            value={patrimonio.total}
            tone="sage"
            variant="tinted"
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
                label: "di cui iniziale",
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
            variant="solid"
            className="sm:col-span-2"
            breakdown={[
              {
                label: "Liquida (conti − tasse da pagare)",
                value: disponibilitaLiquida,
              },
              { label: "Bloccata (patrimonio)", value: patrimonio.total },
            ]}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Quanto hai risparmiato davvero nel {year}
          </CardTitle>
          <p className="font-mono text-4xl font-bold tracking-tight tabular-nums">
            {savedTotal >= 0 ? "+" : ""}
            {euro(savedTotal)}
          </p>
          <p className="text-muted-foreground text-sm">
            Entrate meno uscite di ogni mese, in media {euro(monthlyPace)} al
            mese
            {bestMonth.index >= 0 &&
              ` · mese migliore: ${MONTH_LABELS[bestMonth.index].toLowerCase()} (+${euro(bestMonth.total)})`}
            .
          </p>
        </CardHeader>
        <CardContent>
          <SavingsChart months={savedByMonth} />
        </CardContent>
      </Card>
    </div>
  );
}
