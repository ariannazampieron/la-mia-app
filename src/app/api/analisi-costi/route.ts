import {
  applyRateLimit,
  requireApiAuth,
  apiResponse,
  apiError,
} from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getCostAnalysis } from "@/lib/finance/cost-analysis";

export async function GET(req: Request) {
  const limited = await applyRateLimit("analisi-costi", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  if (!Number.isInteger(year))
    return apiError("Parametro year non valido", 400);

  return apiResponse(await getCostAnalysis(session.user.id, year));
}
