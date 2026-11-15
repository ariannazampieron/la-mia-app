/**
 * "What if" scenarios on the Home page. Pure: every input is already computed elsewhere
 * (Home indicators, Analisi costi averages, revenue per client), so the formulas can be
 * checked with plain numbers.
 */

export interface ScenarioInputs {
  /** Savings account balance minus the tax fund (Home "Risparmio"). */
  risparmio: number;
  fondoTasse: number;
  /** Taxes accrued and still to pay, this year and next (Home "Tasse da pagare"). */
  tasseDaPagare: number;
  /** Monthly averages from Analisi costi. */
  survivalMonthly: number;
  /** Work expenses without taxes. */
  workMonthly: number;
  extraMonthly: number;
  travelMonthly: number;
  /** Average monthly revenue from all clients except the biggest one. */
  otherClientsMonthly: number;
  /** Share of revenue set aside for taxes (23%). */
  taxRate: number;
  /** Amount to keep saving each month in scenario 3. */
  monthlySavingsGoal: number;
}

/** Months the money lasts; null means it never runs out (income covers the costs). */
export type Runway = number | null;

function runway(money: number, monthlyBurn: number): Runway {
  if (monthlyBurn <= 0) return null;
  return Math.max(money, 0) / monthlyBurn;
}

export function computeScenarios(i: ScenarioInputs) {
  const savedOnly = i.risparmio;
  const savedNetOfTaxes = i.risparmio + i.fondoTasse - i.tasseDaPagare;
  const workingCosts = i.survivalMonthly + i.workMonthly;
  const allCosts = workingCosts + i.extraMonthly + i.travelMonthly;
  const otherClientsNet = i.otherClientsMonthly * (1 - i.taxRate);

  return {
    /** Scenario 1 — no income at all, only survival costs. */
    jobLoss: {
      savingsOnly: runway(savedOnly, i.survivalMonthly),
      afterTaxes: runway(savedNetOfTaxes, i.survivalMonthly),
      savedOnly,
      savedNetOfTaxes,
    },
    /** Scenario 2 — the biggest client pays late: other clients' revenue keeps coming in. */
    lateClient: {
      savingsOnly: runway(savedOnly, workingCosts - i.otherClientsMonthly),
      afterTaxes: runway(savedNetOfTaxes, workingCosts - i.otherClientsMonthly),
      monthlyBurn: workingCosts - i.otherClientsMonthly,
    },
    /** Scenario 3 — the biggest client is lost: cuts needed to keep saving the goal. */
    clientLoss: {
      allCosts,
      otherClientsNet,
      cutNeeded: allCosts + i.monthlySavingsGoal - otherClientsNet,
    },
  };
}
