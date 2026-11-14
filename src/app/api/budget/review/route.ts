import {
  applyRateLimit,
  requireApiAuth,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getLastStatementImportDate } from "@/lib/finance/user-settings";

/**
 * Last month of `year` fully covered by the statements, from the last import date entered
 * in Transazioni: a month is closed once the import date reaches its last day.
 */
function closedThroughMonth(year: number, importDate: string | null): number {
  if (!importDate) return 0;
  const [importYear, importMonth, importDay] = importDate
    .split("-")
    .map(Number);
  if (importYear > year) return 12;
  if (importYear < year) return 0;
  const lastDay = new Date(Date.UTC(importYear, importMonth, 0)).getUTCDate();
  return importDay === lastDay ? importMonth : importMonth - 1;
}

/** Which months the Review tab shows as actuals (the rest is the editable budget). */
export async function GET(req: Request) {
  const limited = await applyRateLimit("budget-review", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year))
    return apiError("Parametro year non valido", 400);

  const importDate = await getLastStatementImportDate(session.user.id);
  return apiResponse({
    closedThroughMonth: closedThroughMonth(year, importDate),
  });
}
