import { z } from "zod";
import { db } from "@/lib/db";
import { transactions, financeAccounts } from "@/lib/schema";
import { and, desc, eq, gte, lte, count, isNull, sql } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  findCashAccountId,
  syncCashMirror,
} from "@/lib/finance/cash-withdrawal";

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
        // True when a "Contanti" income mirrors this row (it's a cash withdrawal).
        isCashWithdrawal: sql<boolean>`exists (select 1 from transactions m where m.cash_source_id = ${transactions.id})`,
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
  isCashWithdrawal: z.boolean().default(false),
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
    .select({ id: financeAccounts.id, name: financeAccounts.name })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.id, data.accountId),
        eq(financeAccounts.userId, session.user.id)
      )
    )
    .limit(1);
  if (!account) return apiError("Conto non trovato", 404);

  const cashAccountId = data.isCashWithdrawal
    ? await findCashAccountId(session.user.id)
    : null;

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transactions)
      .values({
        userId: session.user.id,
        accountId: data.accountId,
        categoryId: data.categoryId,
        date: data.date,
        description: data.description,
        amount: data.amount.toFixed(2),
        type: data.type,
        // A withdrawal is always internal: the real spending is tracked on "Contanti".
        isInternalTransfer: data.isInternalTransfer || data.isCashWithdrawal,
        source: "manual",
      })
      .returning({
        id: transactions.id,
        accountId: transactions.accountId,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        source: transactions.source,
      });
    if (cashAccountId) {
      await syncCashMirror(
        tx,
        session.user.id,
        cashAccountId,
        { ...row, accountName: account.name },
        true
      );
    }
    return row;
  });

  return apiResponse({ id: created.id }, 201);
}
