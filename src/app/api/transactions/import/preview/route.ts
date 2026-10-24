import { db } from "@/lib/db";
import { financeAccounts, categories, transactions } from "@/lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { applyRateLimit, requireApiAuth, apiResponse, apiError } from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseStatementFile, type ParsedRow } from "@/lib/finance/import-parser";
import {
  fetchHistoryCandidates,
  matchCategoryFromHistory,
  suggestCategoryViaAI,
  type HistoryCandidate,
} from "@/lib/finance/categorize";

export interface PreviewRow {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId: string | null;
  categoryName: string | null;
  categorySource: "csv" | "history" | "ai" | null;
  isDuplicate: boolean;
}

export async function POST(req: Request) {
  const limited = await applyRateLimit("transactions-import-preview", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file");
  const accountId = formData.get("accountId");

  if (!(file instanceof File)) return apiError("File mancante", 400);
  if (typeof accountId !== "string" || !accountId) {
    return apiError("Conto mancante", 400);
  }

  const [account] = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(
      and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, session.user.id))
    )
    .limit(1);
  if (!account) return apiError("Conto non trovato", 404);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseStatementFile(buffer);

  if (errors.length > 0) {
    return apiError("Il file contiene righe non valide. Correggi e riprova.", 422, {
      rows: errors,
    });
  }
  if (rows.length === 0) {
    return apiError("Nessuna riga da importare nel file.", 422);
  }

  const userCategories = await db
    .select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(eq(categories.userId, session.user.id));

  // Single query covering the whole date range of the file, instead of one query per row.
  const dates = rows.map((r) => r.date).sort();
  const existingInRange = await db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        gte(transactions.date, dates[0]),
        lte(transactions.date, dates[dates.length - 1])
      )
    );
  const existingKeys = new Set(
    existingInRange.map(
      (e) => `${e.date}|${Number(e.amount).toFixed(2)}|${e.description.trim().toLowerCase()}`
    )
  );

  // History candidates fetched once per type present in the file, reused for every row.
  const historyByType = new Map<ParsedRow["type"], HistoryCandidate[]>();
  for (const type of new Set(rows.map((r) => r.type))) {
    historyByType.set(type, await fetchHistoryCandidates(accountId, type));
  }

  const preview: PreviewRow[] = [];

  for (const row of rows) {
    const key = `${row.date}|${row.amount.toFixed(2)}|${row.description.trim().toLowerCase()}`;
    const isDuplicate = existingKeys.has(key);

    let categoryId: string | null = null;
    let categoryName: string | null = null;
    let categorySource: PreviewRow["categorySource"] = null;

    if (row.categoryName) {
      const matched = userCategories.find(
        (c) => c.name.toLowerCase() === row.categoryName!.toLowerCase() && c.type === row.type
      );
      if (matched) {
        categoryId = matched.id;
        categoryName = matched.name;
        categorySource = "csv";
      }
    }

    if (!categoryId) {
      const history = historyByType.get(row.type) ?? [];
      const historyMatch = matchCategoryFromHistory(history, row.description);
      if (historyMatch) {
        categoryId = historyMatch.categoryId;
        categoryName = historyMatch.categoryName;
        categorySource = historyMatch.source;
      } else {
        const aiMatch = await suggestCategoryViaAI(
          row.description,
          userCategories.filter((c) => c.type === row.type)
        );
        if (aiMatch) {
          categoryId = aiMatch.categoryId;
          categoryName = aiMatch.categoryName;
          categorySource = aiMatch.source;
        }
      }
    }

    preview.push({
      rowNumber: row.rowNumber,
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type,
      categoryId,
      categoryName,
      categorySource,
      isDuplicate,
    });
  }

  return apiResponse({ rows: preview, categories: userCategories });
}
