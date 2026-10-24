import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { financeAccounts, transactions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const confirmRowSchema = z.object({
  date: z.string().date(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid().nullable(),
});

const confirmSchema = z.object({
  accountId: z.string().uuid(),
  rows: z.array(confirmRowSchema).min(1).max(1000),
});

export async function POST(req: Request) {
  const limited = await applyRateLimit("transactions-import-confirm", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, confirmSchema);
  if (parseErr) return parseErr;

  const [account] = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.id, data.accountId),
        eq(financeAccounts.userId, session.user.id)
      )
    )
    .limit(1);
  if (!account) return apiError("Conto non trovato", 404);

  const importBatchId = randomUUID();

  await db.insert(transactions).values(
    data.rows.map((row) => ({
      userId: session.user.id,
      accountId: data.accountId,
      categoryId: row.categoryId,
      date: row.date,
      description: row.description,
      amount: row.amount.toFixed(2),
      type: row.type,
      source: "import" as const,
      importBatchId,
    }))
  );

  return apiResponse({ imported: data.rows.length, importBatchId });
}
