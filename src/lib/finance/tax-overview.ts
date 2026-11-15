import { db } from "@/lib/db";
import { taxDueAmounts } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  getFatturatoAnnuale,
  getImposteAnnuali,
  getSavingsAccount,
} from "@/lib/finance/calculations";
import { computeTaxCoverage, type TaxYearCoverage } from "@/lib/finance/taxes";
import {
  estimateNextYearTaxes,
  TAX_YEAR_PARAMS,
} from "@/lib/finance/tax-estimate";

export interface TaxOverview {
  /** Conto Arancio Deposito balance: it pays the taxes first, the rest is savings. */
  savingsBalance: number;
  savingsAccountName: string | null;
  /** Taxes accrued and still to pay, this year and next. */
  tasseDaPagare: number;
  /** Part of the savings balance reserved for those taxes (never more than the balance). */
  fondoTasse: number;
  /** What's left of the savings balance once the taxes are covered. */
  risparmio: number;
  taxes: TaxYearCoverage[];
}

/**
 * Taxes still to pay in the current calendar year and the next one, and how the savings
 * account splits between them (Fondo Tasse) and real savings (Risparmio). The current
 * year's total is entered by hand; the next year's is estimated from the revenue collected
 * so far, when that year's parameters are known.
 */
export async function getTaxOverview(userId: string): Promise<TaxOverview> {
  const currentYear = new Date().getFullYear();
  const taxYears = [currentYear, currentYear + 1];

  const [revenue, dueRows, savingsAccount, paidCurrent, paidNext] =
    await Promise.all([
      getFatturatoAnnuale(userId, currentYear),
      db
        .select({ year: taxDueAmounts.year, amount: taxDueAmounts.amount })
        .from(taxDueAmounts)
        .where(
          and(
            eq(taxDueAmounts.userId, userId),
            inArray(taxDueAmounts.year, taxYears)
          )
        ),
      getSavingsAccount(userId),
      getImposteAnnuali(userId, currentYear),
      getImposteAnnuali(userId, currentYear + 1),
    ]);

  const dueByYear = new Map(dueRows.map((r) => [r.year, Number(r.amount)]));
  const params = TAX_YEAR_PARAMS[currentYear];
  const estimate = params
    ? estimateNextYearTaxes(revenue, currentYear, params)
    : null;
  const savingsBalance = savingsAccount?.balance ?? 0;

  const taxes = computeTaxCoverage(savingsBalance, [
    {
      year: currentYear,
      due: dueByYear.get(currentYear) ?? null,
      paid: paidCurrent,
    },
    estimate
      ? {
          year: currentYear + 1,
          due: estimate.total,
          paid: paidNext,
          estimate: estimate.lines,
        }
      : {
          year: currentYear + 1,
          due: dueByYear.get(currentYear + 1) ?? null,
          paid: paidNext,
        },
  ]);

  const tasseDaPagare = taxes.reduce((sum, t) => sum + t.remaining, 0);
  const fondoTasse = Math.min(Math.max(savingsBalance, 0), tasseDaPagare);

  return {
    savingsBalance,
    savingsAccountName: savingsAccount?.name ?? null,
    tasseDaPagare,
    fondoTasse,
    risparmio: savingsBalance - fondoTasse,
    taxes,
  };
}
