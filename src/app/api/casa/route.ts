import { z } from "zod";
import { db } from "@/lib/db";
import { transactions, categories, casaManualTotals } from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  CASA_SECTIONS,
  CASA_START_YEAR,
  AUTO_TRACKING_START_YEAR,
  type CasaSectionKey,
} from "@/lib/finance/casa-sections";

export interface CasaYearValue {
  year: number;
  amount: number;
  isManual: boolean;
  /** Whether this cell can be edited: always true for categoryless sections (e.g. "acquisto"),
   *  for years before the app started tracking transactions, or for years with an existing manual override. */
  editable: boolean;
}

export async function GET() {
  const limited = await applyRateLimit("casa-summary", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const userId = session.user.id;
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - CASA_START_YEAR + 1 },
    (_, i) => CASA_START_YEAR + i
  );

  // One query for all manual totals, one query per transaction type for category sums —
  // no per-section/per-year queries. Expense and income are queried separately (and kept in
  // separate maps) because a category name like "UTENZE" exists as BOTH an expense and an
  // income category — grouping by name alone without a type-scoped query/map would merge them.
  const manualRows = await db
    .select({
      section: casaManualTotals.section,
      year: casaManualTotals.year,
      amount: casaManualTotals.amount,
    })
    .from(casaManualTotals)
    .where(eq(casaManualTotals.userId, userId));

  const allExpenseCategoryNames = CASA_SECTIONS.flatMap((s) => s.categoryNames);
  const allIncomeOffsetCategoryNames = CASA_SECTIONS.flatMap(
    (s) => s.incomeOffsetCategoryNames
  );

  async function sumByCategoryAndYear(type: "expense" | "income", names: string[]) {
    if (names.length === 0) return [] as { categoryName: string; year: number; total: string }[];
    return db
      .select({
        categoryName: categories.name,
        year: sql<number>`extract(year from ${transactions.date})::int`,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.isInternalTransfer, false),
          eq(transactions.type, type),
          eq(categories.type, type),
          inArray(categories.name, names)
        )
      )
      .groupBy(categories.name, sql`extract(year from ${transactions.date})`);
  }

  const [expenseRows, incomeOffsetRows] = await Promise.all([
    sumByCategoryAndYear("expense", allExpenseCategoryNames),
    sumByCategoryAndYear("income", allIncomeOffsetCategoryNames),
  ]);

  const manualMap = new Map<string, number>(
    manualRows.map((r) => [`${r.section}-${r.year}`, Number(r.amount)])
  );
  const expenseMap = new Map<string, number>(
    expenseRows.map((r) => [`${r.categoryName}-${r.year}`, Number(r.total)])
  );
  const incomeOffsetMap = new Map<string, number>(
    incomeOffsetRows.map((r) => [`${r.categoryName}-${r.year}`, Number(r.total)])
  );

  const sections = CASA_SECTIONS.map((section) => {
    const values: CasaYearValue[] = years.map((year) => {
      const manualKey = `${section.key}-${year}`;
      const alwaysManual = section.categoryNames.length === 0 || year < AUTO_TRACKING_START_YEAR;

      if (manualMap.has(manualKey)) {
        return { year, amount: manualMap.get(manualKey)!, isManual: true, editable: true };
      }
      const expenseTotal = section.categoryNames.reduce(
        (sum, name) => sum + (expenseMap.get(`${name}-${year}`) ?? 0),
        0
      );
      const incomeOffsetTotal = section.incomeOffsetCategoryNames.reduce(
        (sum, name) => sum + (incomeOffsetMap.get(`${name}-${year}`) ?? 0),
        0
      );
      const computed = Math.max(0, expenseTotal - incomeOffsetTotal);
      return { year, amount: computed, isManual: false, editable: alwaysManual };
    });
    return { key: section.key, label: section.label, values };
  });

  return apiResponse({ sections });
}

const upsertSchema = z.object({
  section: z.enum(
    CASA_SECTIONS.map((s) => s.key) as [CasaSectionKey, ...CasaSectionKey[]]
  ),
  year: z.number().int().min(2000).max(2100),
  amount: z.coerce.number().min(0),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("casa-upsert", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, upsertSchema);
  if (parseErr) return parseErr;

  await db
    .insert(casaManualTotals)
    .values({
      userId: session.user.id,
      section: data.section,
      year: data.year,
      amount: data.amount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [casaManualTotals.userId, casaManualTotals.section, casaManualTotals.year],
      set: { amount: data.amount.toFixed(2) },
    });

  return apiResponse({ ok: true });
}
