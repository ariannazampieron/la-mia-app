import type {
  ContoEconomicoCategory,
  MonthBalance,
} from "@/components/finance/conto-economico-table";

/**
 * The "Review" budget: actuals for the closed months, and for the open ones the re-forecast
 * amount when entered, otherwise the original budget. Its balances follow the real ones up
 * to the last closed month, then project forward from that real closing with the review flows.
 * Cell maps are keyed `${categoryId}-${month}` like the rest of the Budget page.
 */
export function buildReview({
  categories,
  planned,
  actual,
  reviewEntries,
  closedThroughMonth,
  plannedBalances,
  actualBalances,
}: {
  categories: ContoEconomicoCategory[];
  planned: Map<string, number>;
  actual: Map<string, number>;
  reviewEntries: Map<string, number>;
  closedThroughMonth: number;
  plannedBalances: MonthBalance[];
  actualBalances: MonthBalance[];
}): { amounts: Map<string, number>; balances: MonthBalance[] } {
  const amounts = new Map<string, number>();
  for (const category of categories) {
    for (let month = 1; month <= 12; month++) {
      const key = `${category.id}-${month}`;
      const value =
        month <= closedThroughMonth
          ? (actual.get(key) ?? 0)
          : (reviewEntries.get(key) ?? planned.get(key) ?? 0);
      if (value !== 0) amounts.set(key, value);
    }
  }

  const actualByMonth = new Map(actualBalances.map((b) => [b.month, b]));
  let opening =
    closedThroughMonth > 0
      ? (actualByMonth.get(closedThroughMonth)?.closing ?? 0)
      : (plannedBalances.find((b) => b.month === 1)?.opening ?? 0);

  const balances: MonthBalance[] = [];
  for (let month = 1; month <= 12; month++) {
    const real = actualByMonth.get(month);
    if (month <= closedThroughMonth && real) {
      balances.push(real);
      continue;
    }
    let revenueTotal = 0;
    let costTotal = 0;
    for (const category of categories) {
      const value = amounts.get(`${category.id}-${month}`) ?? 0;
      if (category.type === "income") revenueTotal += value;
      else costTotal += value;
    }
    const cashFlow = revenueTotal - costTotal;
    balances.push({
      month,
      opening,
      closing: opening + cashFlow,
      revenueTotal,
      costTotal,
      cashFlow,
      otherMovements: 0,
    });
    opening += cashFlow;
  }

  return { amounts, balances };
}
