import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { groupExpenseCategories } from "@/lib/finance/expense-groups";

/** Extra-expense categories left out of the "extra" average, each handled on its own (or not at all). */
const EXCLUDED_FROM_EXTRA = ["ACCANTONAMENTO", "VIAGGI"];
const TRAVEL_CATEGORY = "VIAGGI";
const TOOL_CATEGORIES = {
  personali: "TOOL PERSONALI",
  lavoro: "TOOL LAVORO",
} as const;

/** Utility bills, matched by a whole word in the description. */
const UTILITIES = [
  {
    key: "energia",
    label: "Energia elettrica",
    supplier: "Alperia",
    pattern: "alperia",
  },
  { key: "acqua", label: "Acqua", supplier: "Hera", pattern: "hera" },
  { key: "gas", label: "Gas", supplier: "SGR", pattern: "sgr" },
  { key: "legna", label: "Legna", supplier: "Legna", pattern: "legna" },
] as const;

/** A tool with at least two charges and none in this many days of data is shown as dismissed. */
const DISMISSED_AFTER_DAYS = 45;

/** Same tool written differently by different banks ("Anthropic* claude sub", "Claude.ai"). */
const MERCHANT_ALIASES: Record<string, string> = { anthropic: "claude" };

/** "Paypal *netflix", "NETFLIX SERVICES ITALY SRL - Pagamento preautorizzato utenza" → "netflix". */
export function merchantKey(description: string): string {
  const cleaned = description
    .toLowerCase()
    .replace(/^paypal\s*\*\s*/, "")
    .replace(/\s+-\s+pagamento preautorizzato.*$/, "");
  const word =
    cleaned
      .split(/[^a-z0-9àèéìòù]+/)
      .find((w) => w.length >= 2 && !/^\d+$/.test(w)) ?? cleaned.trim();
  return MERCHANT_ALIASES[word] ?? word;
}

export interface CostGroup {
  key: "sopravvivenza" | "lavoro" | "extra" | "viaggi";
  label: string;
  total: number;
  monthlyAverage: number;
}

export interface RecurringItem {
  name: string;
  /** Last amount charged. */
  monthly: number;
  yearTotal: number;
  lastChargeDate: string;
  dismissed: boolean;
}

export interface AverageItem {
  label: string;
  detail?: string;
  monthlyAverage: number;
  yearTotal: number;
}

export interface CostAnalysis {
  year: number;
  monthsCount: number;
  groups: CostGroup[];
  tools: { personali: RecurringItem[]; lavoro: RecurringItem[] };
  telecom: AverageItem[];
  utilities: AverageItem[];
}

function buildRecurring(
  charges: { date: string; description: string; amount: number }[],
  referenceDate: string | null
): RecurringItem[] {
  const byMerchant = new Map<string, typeof charges>();
  for (const charge of charges) {
    const key = merchantKey(charge.description);
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), charge]);
  }
  const reference = referenceDate
    ? new Date(referenceDate).getTime()
    : Date.now();
  return [...byMerchant.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const last = sorted[sorted.length - 1];
      const daysSinceLast =
        (reference - new Date(last.date).getTime()) / 86_400_000;
      return {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        monthly: last.amount,
        yearTotal: sorted.reduce((sum, c) => sum + c.amount, 0),
        lastChargeDate: last.date,
        dismissed: sorted.length >= 2 && daysSinceLast > DISMISSED_AFTER_DAYS,
      };
    })
    .sort(
      (a, b) =>
        Number(a.dismissed) - Number(b.dismissed) || b.yearTotal - a.yearTotal
    );
}

export async function getCostAnalysis(
  userId: string,
  year: number
): Promise<CostAnalysis> {
  const inYear = sql`extract(year from ${transactions.date}) = ${year}`;
  const realExpense = and(
    eq(transactions.userId, userId),
    eq(transactions.type, "expense"),
    eq(transactions.isInternalTransfer, false),
    inYear
  );

  const [categoryTotals, [coverage], toolCharges, [utilityTotals]] =
    await Promise.all([
      db
        .select({
          name: categories.name,
          total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .where(realExpense)
        .groupBy(categories.name),
      // Months to average over: January up to the last month with categorized data (as in
      // Rendiconto); the latest transaction date is the reference for dismissed tools.
      db
        .select({
          lastMonth: sql<
            number | null
          >`max(extract(month from ${transactions.date}))::int`,
          lastDate: sql<string | null>`max(${transactions.date})::text`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.isInternalTransfer, false),
            isNotNull(transactions.categoryId),
            inYear
          )
        ),
      db
        .select({
          date: transactions.date,
          description: transactions.description,
          amount: transactions.amount,
          category: categories.name,
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            realExpense,
            inArray(categories.name, [
              TOOL_CATEGORIES.personali,
              TOOL_CATEGORIES.lavoro,
            ])
          )
        )
        .limit(1000),
      db
        .select(
          Object.fromEntries(
            UTILITIES.map((u) => [
              u.key,
              sql<string>`coalesce(sum(case when ${transactions.description} ~* ${`\\m${u.pattern}\\M`} then ${transactions.amount} else 0 end), 0)`,
            ])
          ) as Record<
            (typeof UTILITIES)[number]["key"],
            ReturnType<typeof sql<string>>
          >
        )
        .from(transactions)
        .where(realExpense),
    ]);

  const monthsCount = coverage?.lastMonth ?? 0;
  const average = (total: number) =>
    monthsCount > 0 ? total / monthsCount : 0;
  const totalByName = new Map(
    categoryTotals.map((r) => [r.name, Number(r.total)])
  );
  const sumOf = (names: string[]) =>
    names.reduce((sum, n) => sum + (totalByName.get(n) ?? 0), 0);

  const expenseGroups = groupExpenseCategories(
    [...totalByName.keys()].map((name) => ({ name }))
  );
  const groupTotal = (key: string, exclude: string[] = []) =>
    sumOf(
      (expenseGroups.find((g) => g.key === key)?.categories ?? [])
        .map((c) => c.name)
        .filter((n) => !exclude.includes(n))
    );
  const groups: CostGroup[] = [
    {
      key: "sopravvivenza",
      label: "Sopravvivenza",
      total: groupTotal("sopravvivenza"),
    },
    { key: "lavoro", label: "Lavorative", total: groupTotal("lavoro") },
    {
      key: "extra",
      label: "Extra",
      total: groupTotal("extra", EXCLUDED_FROM_EXTRA),
    },
    { key: "viaggi", label: "Viaggi", total: sumOf([TRAVEL_CATEGORY]) },
  ].map((g) => ({
    ...g,
    key: g.key as CostGroup["key"],
    monthlyAverage: average(g.total),
  }));

  const charges = (category: string) =>
    toolCharges
      .filter((c) => c.category === category)
      .map((c) => ({
        date: c.date,
        description: c.description,
        amount: Number(c.amount),
      }));
  const reference = coverage?.lastDate ?? null;

  const averageItem = (
    label: string,
    total: number,
    detail?: string
  ): AverageItem => ({
    label,
    detail,
    monthlyAverage: average(total),
    yearTotal: total,
  });

  return {
    year,
    monthsCount,
    groups,
    tools: {
      personali: buildRecurring(charges(TOOL_CATEGORIES.personali), reference),
      lavoro: buildRecurring(charges(TOOL_CATEGORIES.lavoro), reference),
    },
    telecom: [
      averageItem("Telefono", sumOf(["TELEFONO"])),
      averageItem("Internet", sumOf(["INTERNET"])),
    ],
    utilities: UTILITIES.map((u) =>
      averageItem(u.label, Number(utilityTotals?.[u.key] ?? 0), u.supplier)
    ),
  };
}
