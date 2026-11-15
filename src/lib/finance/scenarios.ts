/**
 * "What if" scenario and goals on the Home page. Pure: every input is already computed
 * elsewhere (savings split from getTaxOverview, survival average from Analisi costi), so the
 * formulas can be checked with plain numbers.
 */

/** Months the money lasts; null means there are no costs to cover. */
export type Runway = number | null;

const monthsFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
});

/** "7,5 mesi", or "Senza limite" when there are no costs to cover. */
export function formatRunway(months: Runway): string {
  if (months === null) return "Senza limite";
  return `${monthsFormatter.format(months)} ${months === 1 ? "mese" : "mesi"}`;
}

function runway(money: number, monthlyCost: number): Runway {
  if (monthlyCost <= 0) return null;
  return Math.max(money, 0) / monthlyCost;
}

/** Months of survival expenses the savings should cover. */
export const SAFETY_MONTHS_GOAL = 8;

export function computeHomeGoals({
  savingsBalance,
  risparmio,
  fondoTasse,
  tasseDaPagare,
  survivalMonthly,
}: {
  /** Conto Arancio Deposito balance (= Fondo Tasse + Risparmio). */
  savingsBalance: number;
  risparmio: number;
  fondoTasse: number;
  tasseDaPagare: number;
  survivalMonthly: number;
}) {
  const safetyTarget = SAFETY_MONTHS_GOAL * survivalMonthly;
  return {
    /** Goal 1 — savings cover SAFETY_MONTHS_GOAL months of survival expenses. */
    safety: {
      target: safetyTarget,
      current: Math.max(risparmio, 0),
      progress: safetyTarget > 0 ? Math.max(risparmio, 0) / safetyTarget : 1,
      missing: Math.max(safetyTarget - risparmio, 0),
      monthsCovered: runway(risparmio, survivalMonthly),
    },
    /** Goal 2 — the tax fund covers every tax accrued so far. */
    taxes: {
      target: tasseDaPagare,
      current: fondoTasse,
      progress: tasseDaPagare > 0 ? fondoTasse / tasseDaPagare : 1,
      missing: Math.max(tasseDaPagare - fondoTasse, 0),
    },
    /** Scenario 1 — I lose my job: how many months can I go on? */
    jobLoss: {
      /** All the savings account, as if taxes didn't exist. */
      ignoringTaxes: runway(savingsBalance, survivalMonthly),
      /** Only what's left after the taxes are paid. */
      afterTaxes: runway(risparmio, survivalMonthly),
    },
  };
}

/**
 * How the savings account grew month by month, split as the Home splits it today: the
 * balance fills the tax fund first (up to the taxes to pay), the rest is savings.
 * Returns, per month, how much each part grew (negative when money was taken out).
 */
export function monthlySavingsSplit(
  yearOpening: number,
  monthEnd: number[],
  taxTarget: number
): { fondoTasse: number; risparmio: number }[] {
  const split = (balance: number) => {
    const fondo = Math.min(Math.max(balance, 0), taxTarget);
    return { fondo, risparmio: balance - fondo };
  };
  return monthEnd.map((balance, i) => {
    const before = split(i === 0 ? yearOpening : monthEnd[i - 1]);
    const after = split(balance);
    return {
      fondoTasse: after.fondo - before.fondo,
      risparmio: after.risparmio - before.risparmio,
    };
  });
}
