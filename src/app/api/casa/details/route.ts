import { db } from "@/lib/db";
import {
  transactions,
  categories,
  casaManualTotals,
  financeAccounts,
} from "@/lib/schema";
import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { CASA_SECTIONS, CASA_START_YEAR } from "@/lib/finance/casa-sections";

export interface CasaDetailItem {
  date: string;
  description: string;
  account: string;
  category: string;
  /** Positive for expenses, negative for refunds that reduce the section total. */
  amount: number;
}

export interface CasaDetailYear {
  year: number;
  /** True when the year's total was entered by hand: its items aren't in the app. */
  manual: boolean;
  manualAmount: number | null;
  items: CasaDetailItem[];
}

/** The transactions behind each year of one Casa section (or the hand-entered total). */
export async function GET(req: Request) {
  const limited = await applyRateLimit("casa-details", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const section = CASA_SECTIONS.find(
    (s) => s.key === searchParams.get("section")
  );
  if (!section) return apiError("Sezione non valida", 400);

  const userId = session.user.id;
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - CASA_START_YEAR + 1 },
    (_, i) => CASA_START_YEAR + i
  );

  const expenseNames: string[] = [...section.categoryNames];
  const incomeNames: string[] = [...section.incomeOffsetCategoryNames];
  const typeMatches = [
    ...(expenseNames.length > 0
      ? [
          and(
            eq(transactions.type, "expense"),
            eq(categories.type, "expense"),
            inArray(categories.name, expenseNames)
          ),
        ]
      : []),
    ...(incomeNames.length > 0
      ? [
          and(
            eq(transactions.type, "income"),
            eq(categories.type, "income"),
            inArray(categories.name, incomeNames)
          ),
        ]
      : []),
  ];

  const [manualRows, rows] = await Promise.all([
    db
      .select({ year: casaManualTotals.year, amount: casaManualTotals.amount })
      .from(casaManualTotals)
      .where(
        and(
          eq(casaManualTotals.userId, userId),
          eq(casaManualTotals.section, section.key)
        )
      ),
    typeMatches.length > 0
      ? db
          .select({
            date: transactions.date,
            description: transactions.description,
            amount: transactions.amount,
            type: transactions.type,
            account: financeAccounts.name,
            category: categories.name,
          })
          .from(transactions)
          .innerJoin(categories, eq(transactions.categoryId, categories.id))
          .innerJoin(
            financeAccounts,
            eq(transactions.accountId, financeAccounts.id)
          )
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.isInternalTransfer, false),
              gte(transactions.date, `${CASA_START_YEAR}-01-01`),
              or(...typeMatches)
            )
          )
          .orderBy(asc(transactions.date))
          .limit(2000)
      : Promise.resolve([]),
  ]);

  const manualByYear = new Map(
    manualRows.map((r) => [r.year, Number(r.amount)])
  );
  const result: CasaDetailYear[] = years.map((year) => {
    const manual = manualByYear.has(year);
    return {
      year,
      manual,
      manualAmount: manual ? manualByYear.get(year)! : null,
      // A hand-entered total replaces the transactions, so they're not listed.
      items: manual
        ? []
        : rows
            .filter((r) => r.date.startsWith(`${year}-`))
            .map((r) => ({
              date: r.date,
              description: r.description,
              account: r.account,
              category: r.category,
              amount:
                r.type === "income" ? -Number(r.amount) : Number(r.amount),
            })),
    };
  });

  return apiResponse({ years: result });
}
