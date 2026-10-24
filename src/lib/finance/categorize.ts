import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  source: "history" | "ai";
}

export interface HistoryCandidate {
  categoryId: string;
  categoryName: string;
  description: string;
}

function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ");
}

/** Fetches already-categorized transactions for an account+type once, reused across all rows of an import. */
export async function fetchHistoryCandidates(
  accountId: string,
  type: "income" | "expense"
): Promise<HistoryCandidate[]> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      description: transactions.description,
      categoryName: categories.name,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.accountId, accountId),
        eq(transactions.type, type),
        isNotNull(transactions.categoryId)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(200);

  return rows.map((r) => ({
    categoryId: r.categoryId!,
    categoryName: r.categoryName,
    description: r.description,
  }));
}

/** Pure in-memory match against a pre-fetched history list — no DB access, safe to call per row. */
export function matchCategoryFromHistory(
  history: HistoryCandidate[],
  description: string
): CategorySuggestion | null {
  const normalized = normalizeDescription(description);

  for (const candidate of history) {
    const historyNormalized = normalizeDescription(candidate.description);
    if (
      historyNormalized.length >= 4 &&
      (normalized.includes(historyNormalized) || historyNormalized.includes(normalized))
    ) {
      return {
        categoryId: candidate.categoryId,
        categoryName: candidate.categoryName,
        source: "history",
      };
    }
  }
  return null;
}

/** Falls back to an OpenRouter model choosing among the given fixed categories. Returns null if unavailable or unconfident. */
export async function suggestCategoryViaAI(
  description: string,
  availableCategories: { id: string; name: string }[]
): Promise<CategorySuggestion | null> {
  if (!process.env.OPENROUTER_API_KEY || availableCategories.length === 0) return null;

  try {
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const model = openrouter(process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini");

    const { object } = await generateObject({
      model,
      schema: z.object({ categoryName: z.string().nullable() }),
      prompt: `Descrizione transazione: "${description}". Categorie disponibili: ${availableCategories
        .map((c) => c.name)
        .join(", ")}. Scegli il nome esatto della categoria più probabile da questo elenco, oppure null se nessuna è ragionevole.`,
    });

    const match = availableCategories.find((c) => c.name === object.categoryName);
    if (!match) return null;

    return { categoryId: match.id, categoryName: match.name, source: "ai" };
  } catch {
    return null;
  }
}
