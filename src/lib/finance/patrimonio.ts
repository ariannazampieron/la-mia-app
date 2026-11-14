import { db } from "@/lib/db";
import { categories, transactions, userSettings } from "@/lib/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/** Starting values until they're changed from the Home page. */
export const PATRIMONIO_DEFAULTS = {
  houseValue: 45000,
  investmentsValue: 0,
  pensionFundBase: 2000,
  pensionFundSince: "2026-11-01",
};

const PENSION_FUND_CATEGORY = "FONDO PENSIONE";

export interface Patrimonio {
  houseValue: number;
  investmentsValue: number;
  /** Base value + "FONDO PENSIONE" transactions since `pensionFundSince`. */
  pensionFund: number;
  pensionFundBase: number;
  pensionFundSince: string;
  total: number;
}

export async function getPatrimonio(userId: string): Promise<Patrimonio> {
  const [settings] = await db
    .select({
      houseValue: userSettings.houseValue,
      investmentsValue: userSettings.investmentsValue,
      pensionFundBase: userSettings.pensionFundBase,
      pensionFundSince: userSettings.pensionFundSince,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const houseValue = Number(
    settings?.houseValue ?? PATRIMONIO_DEFAULTS.houseValue
  );
  const investmentsValue = Number(
    settings?.investmentsValue ?? PATRIMONIO_DEFAULTS.investmentsValue
  );
  const pensionFundBase = Number(
    settings?.pensionFundBase ?? PATRIMONIO_DEFAULTS.pensionFundBase
  );
  const pensionFundSince =
    settings?.pensionFundSince ?? PATRIMONIO_DEFAULTS.pensionFundSince;

  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        eq(categories.name, PENSION_FUND_CATEGORY),
        gte(transactions.date, pensionFundSince)
      )
    );
  const pensionFund = pensionFundBase + Number(row?.total ?? 0);

  return {
    houseValue,
    investmentsValue,
    pensionFund,
    pensionFundBase,
    pensionFundSince,
    total: houseValue + investmentsValue + pensionFund,
  };
}
