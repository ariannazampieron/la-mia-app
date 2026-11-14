import { z } from "zod";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  applyRateLimit,
  requireApiAuth,
  parseBody,
  apiResponse,
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
  lastStatementImportDate: z.string().date().nullable(),
});

export async function PUT(req: Request) {
  const limited = await applyRateLimit("settings-update", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { data, error: parseErr } = await parseBody(req, updateSchema);
  if (parseErr) return parseErr;

  await db
    .insert(userSettings)
    .values({
      userId: session.user.id,
      lastStatementImportDate: data.lastStatementImportDate,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { lastStatementImportDate: data.lastStatementImportDate },
    });

  return apiResponse({ ok: true });
}
