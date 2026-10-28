import { z } from "zod";
import { db } from "@/lib/db";
import { transactions, financeAccounts } from "@/lib/schema";
import { and, desc, eq, gte, lte, count, isNull } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

const MAX_PAGE_SIZE = 50;

export async function GET(req: Request) {
  const limited = await applyRateLimit("transactions-list", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const categoryId = searchParams.get("categoryId");
  const type = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const filters = [eq(transactions.userId, session.user.id)];
  if (accountId) filters.push(eq(transactions.accountId, accountId));
  if (categoryId === "__uncategorized__")
    filters.push(isNull(transactions.categoryId));
  else if (categoryId) filters.push(eq(transactions.categoryId, categoryId));
  if (type === "income" || type === "expense")
    filters.push(eq(transactions.type, type));
  if (dateFrom) filters.push(gte(transactions.date, dateFrom));
  if (dateTo) filters.push(lte(transactions.date, dateTo));

  const where = and(...filters);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        categoryId: transactions.categoryId,
        accountId: transactions.accountId,
        isInternalTransfer: transactions.isInternalTransfer,
        source: transactions.source,
      })
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.date))
      .limit(MAX_PAGE_SIZE)
      .offset((page - 1) * MAX_PAGE_SIZE),
    db.select({ total: count() }).from(transactions).where(where),
  ]);

  return apiResponse({
    transactions: rows,
    total,
    page,
    pageSize: MAX_PAGE_SIZE,
  });
}

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  date: z.string().date(),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().positive(),
  type: z.enum(["income", "expense"]),
  isInternalTransfer: z.boolean().default(false),
});

export async function POST(req: Request) {
  const limited = await applyRateLimit("transactions-create", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(
    req,
    createTransactionSchema
  );
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

  const [created] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: data.accountId,
      categoryId: data.categoryId,
      date: data.date,
      description: data.description,
      amount: data.amount.toFixed(2),
      type: data.type,
      isInternalTransfer: data.isInternalTransfer,
      source: "manual",
    })
    .returning({ id: transactions.id });

  return apiResponse({ id: created.id }, 201);
}

const deleteAllSchema = z.object({ confirm: z.literal(true) });

/** Deletes every transaction of the user (used to restart imports from scratch). */
export async function DELETE(req: Request) {
  const limited = await applyRateLimit(
    "transactions-delete-all",
    RATE_LIMITS.api
  );
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { error: parseErr } = await parseBody(req, deleteAllSchema);
  if (parseErr) return parseErr;

  const deleted = await db
    .delete(transactions)
    .where(eq(transactions.userId, session.user.id))
    .returning({ id: transactions.id });

  return apiResponse({ deleted: deleted.length });
}
