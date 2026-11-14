import { z } from "zod";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  const limited = await applyRateLimit("settings-get", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const [row] = await db
    .select({ lastStatementImportDate: userSettings.lastStatementImportDate })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  return apiResponse({
    lastStatementImportDate: row?.lastStatementImportDate ?? null,
  });
}

const updateSchema = z.object({
  lastStatementImportDate: z.string().date().nullable().optional(),
  houseValue: z.number().min(0).optional(),
  investmentsValue: z.number().min(0).optional(),
  pensionFundBase: z.number().min(0).optional(),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("settings-update", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, updateSchema);
  if (parseErr) return parseErr;

  // Only the fields sent are changed: each one is saved on its own from the UI.
  const changes = {
    ...(data.lastStatementImportDate !== undefined && {
      lastStatementImportDate: data.lastStatementImportDate,
    }),
    ...(data.houseValue !== undefined && {
      houseValue: data.houseValue.toFixed(2),
    }),
    ...(data.investmentsValue !== undefined && {
      investmentsValue: data.investmentsValue.toFixed(2),
    }),
    ...(data.pensionFundBase !== undefined && {
      pensionFundBase: data.pensionFundBase.toFixed(2),
    }),
  };
  if (Object.keys(changes).length === 0)
    return apiError("Nessun valore da salvare", 400);

  await db
    .insert(userSettings)
    .values({ userId: session.user.id, ...changes })
    .onConflictDoUpdate({ target: userSettings.userId, set: changes });

  return apiResponse({ ok: true });
}
