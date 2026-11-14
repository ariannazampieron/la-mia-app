export interface TaxYearInput {
  year: number;
  /** Total taxes due in the year; null until it's been entered. */
  due: number | null;
  /** Taxes already paid in the year ("IMPOSTE" transactions). */
  paid: number;
}

export interface TaxYearCoverage extends TaxYearInput {
  /** due - paid, never below zero. */
  remaining: number;
  /** Part of `remaining` covered by the tax fund. */
  covered: number;
  /** Part of `remaining` the tax fund can't cover. */
  shortfall: number;
}

/**
 * Spends the tax fund on each year's remaining taxes in order (earliest year first),
 * so the current year is covered before the next one.
 */
export function computeTaxCoverage(
  fund: number,
  years: TaxYearInput[]
): TaxYearCoverage[] {
  let available = Math.max(fund, 0);
  return years.map((y) => {
    const remaining = Math.max((y.due ?? 0) - y.paid, 0);
    const covered = Math.min(available, remaining);
    available -= covered;
    return { ...y, remaining, covered, shortfall: remaining - covered };
  });
}
