import { db } from "@/lib/db";
import { categories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const EXPENSE_CATEGORIES = [
  "ELETTRONICA",
  "AUTO/TRASPORTI",
  "BEAUTY",
  "MUTUO",
  "CASA - RISTRUTTURAZIONE",
  "CASA - ARREDAMENTO",
  "CASA - MANUTENZIONE",
  "CASA - COMPLEMENTI",
  "CIBO CASA",
  "EXTRA",
  "FORMAZIONE",
  "IMPOSTE",
  "RISTORANTE/BAR",
  "PREVIDENZA",
  "REGALI",
  "SALUTE",
  "SPESE BANCARIE",
  "STIPENDI",
  "TOOL",
  "FONDO PENSIONE",
  "TELEFONO",
  "INTERNET",
  "UTENZE",
  "VESTIARIO",
  "COMMERCIALISTA",
  "VIAGGI",
  "ACCANTONAMENTO",
] as const;

// "Clienti_CONSULENZA" normalizzato con underscore per coerenza con la regola
// "isClientRevenueCategory = nome che inizia con Clienti_" — vedi decisions.md.
export const INCOME_CATEGORIES = [
  "Clienti_LOOP",
  "Clienti_WIT",
  "Clienti_LEARNN",
  "Clienti_CONSULENZA",
  "Clienti_OVER5IZE",
  "INTERESSI",
  "UTENZE",
  "ALTRO",
] as const;

export function isTaxPaymentCategory(name: string): boolean {
  return name === "IMPOSTE";
}

export function isClientRevenueCategory(name: string): boolean {
  return name.startsWith("Clienti_");
}

/** Seeds the fixed category list for a user if they don't have any yet. */
export async function ensureCategoriesSeeded(userId: string) {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  const rows = [
    ...EXPENSE_CATEGORIES.map((name) => ({
      userId,
      name,
      type: "expense" as const,
      isTaxPaymentCategory: isTaxPaymentCategory(name),
      isClientRevenueCategory: false,
    })),
    ...INCOME_CATEGORIES.map((name) => ({
      userId,
      name,
      type: "income" as const,
      isTaxPaymentCategory: false,
      isClientRevenueCategory: isClientRevenueCategory(name),
    })),
  ];

  await db.insert(categories).values(rows);
}
