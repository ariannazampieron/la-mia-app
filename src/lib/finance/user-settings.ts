import { db } from "@/lib/db";
import { userSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";

/** Date of the last bank statement import, as entered in Transazioni (yyyy-mm-dd), or null. */
export async function getLastStatementImportDate(
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ date: userSettings.lastStatementImportDate })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row?.date ?? null;
}
