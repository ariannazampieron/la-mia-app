import { db } from "@/lib/db";
import { taxDueAmounts } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  getFatturatoAnnuale,
  getFondoTasse,
  getImposteAnnuali,
} from "@/lib/finance/calculations";
import { computeTaxCoverage, type TaxYearCoverage } from "@/lib/finance/taxes";
import {
  estimateNextYearTaxes,
  TAX_YEAR_PARAMS,
} from "@/lib/finance/tax-estimate";

/**
 * Taxes still to pay in the current calendar year and the next one, with the tax fund's
 * coverage. The current year's total is entered by hand; the next year's is estimated
 * from the revenue collected so far, when that year's parameters are known.
 */
export async function getTaxOverview(
  userId: string
): Promise<{ fondoTasse: number; taxes: TaxYearCoverage[] }> {
  const currentYear = new Date().getFullYear();
  const taxYears = [currentYear, currentYear + 1];

  const [revenue, dueRows, fondoTasse, paidCurrent, paidNext] =
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
      getFondoTasse(userId, currentYear),
      getImposteAnnuali(userId, currentYear),
      getImposteAnnuali(userId, currentYear + 1),
    ]);

  const dueByYear = new Map(dueRows.map((r) => [r.year, Number(r.amount)]));
  const params = TAX_YEAR_PARAMS[currentYear];
  const estimate = params
    ? estimateNextYearTaxes(revenue, currentYear, params)
    : null;

  const taxes = computeTaxCoverage(fondoTasse, [
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

  return { fondoTasse, taxes };
}
