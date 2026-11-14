/**
 * Estimate of the taxes paid in year Y+1 on the revenue collected in year Y, for a
 * "regime forfettario" activity registered with INPS Gestione Commercianti.
 * Advances use the "metodo storico" (100% of the previous year's amount), the most
 * conservative choice: it never exposes to penalties for underpaid advances.
 * Pure — no database access — so it can be checked with plain numbers.
 */

/** Regime forfettario, ATECO 70.22.09 (consulenza). */
const SUBSTITUTE_TAX_RATE = 0.15;
const PROFITABILITY_COEFFICIENT = 0.78;

/** INPS Gestione Commercianti, with the 35% reduction for forfettari. */
const INPS_MINIMUM_INCOME = 18808; // reddito minimale 2026 (full fixed contribution ≈ 4.612 €/year)
const INPS_RATE = 0.2448;
const INPS_REDUCTION = 0.35;

/** What's known about a tax year from the F24s, so the estimate only needs the revenue. */
export interface TaxYearParams {
  /** INPS contributions paid during the year: deductible from the forfettario income. */
  contributionsPaid: number;
  /** Advances on the substitute tax already paid for this year. */
  substituteTaxAdvancesPaid: number;
  /** Advances on the INPS contribution above the minimum already paid for this year. */
  inpsExcessAdvancesPaid: number;
  /** Fixed INPS contributions (on the minimum income) due in the following year. */
  nextYearFixedContributions: number;
}

/** Keyed by the year whose revenue is taxed. */
export const TAX_YEAR_PARAMS: Record<number, TaxYearParams> = {
  2026: {
    // Gestione Separata saldo 2025 (F24 20/07) + Commercianti fixed rates of May, Aug, Nov.
    contributionsPaid: 3628 + 768 + 1152.93 + 1152.93,
    // Acconti 2026 (F24 20/07 and 30/11), metodo storico on the 2025 tax of 5.783 €.
    substituteTaxAdvancesPaid: 2891.5 + 2891.5,
    // First year in Gestione Commercianti: no advances on the excess yet.
    inpsExcessAdvancesPaid: 0,
    // Fixed contributions with the 35% reduction: 3.074 €/year in four rates (confirmed;
    // the 2026 rates were uneven only because the reduction was requested late).
    nextYearFixedContributions: 3074,
  },
};

export interface TaxEstimateLine {
  label: string;
  value: number;
}

export function estimateNextYearTaxes(
  revenue: number,
  year: number,
  params: TaxYearParams
): { lines: TaxEstimateLine[]; total: number } {
  const grossIncome = revenue * PROFITABILITY_COEFFICIENT;
  const taxableIncome = Math.max(grossIncome - params.contributionsPaid, 0);
  const substituteTax = taxableIncome * SUBSTITUTE_TAX_RATE;
  // The INPS excess is computed on the gross income (contributions are not deducted).
  const inpsExcess =
    Math.max(grossIncome - INPS_MINIMUM_INCOME, 0) *
    INPS_RATE *
    (1 - INPS_REDUCTION);

  const lines: TaxEstimateLine[] = [
    {
      label: `Saldo imposta sostitutiva ${year}`,
      value: Math.max(substituteTax - params.substituteTaxAdvancesPaid, 0),
    },
    { label: `Acconti imposta sostitutiva ${year + 1}`, value: substituteTax },
    {
      label: `INPS contributi fissi ${year + 1}`,
      value: params.nextYearFixedContributions,
    },
    {
      label: `INPS saldo eccedenza minimale ${year}`,
      value: Math.max(inpsExcess - params.inpsExcessAdvancesPaid, 0),
    },
    { label: `INPS acconti eccedenza ${year + 1}`, value: inpsExcess },
  ];
  return { lines, total: lines.reduce((sum, l) => sum + l.value, 0) };
}
