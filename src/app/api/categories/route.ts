import { db } from "@/lib/db";
import { categories } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { applyRateLimit, requireApiAuth, apiResponse } from "@/lib/api-utils";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ensureCategoriesSeeded } from "@/lib/finance/categories";

export async function GET() {
  const limited = await applyRateLimit("categories-list", RATE_LIMITS.api);
  if (limited) return limited;

  const { session, error } = await requireApiAuth();
  if (error) return error;

  await ensureCategoriesSeeded(session.user.id);

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
    })
    .from(categories)
    .where(eq(categories.userId, session.user.id));

  return apiResponse({ categories: rows });
}
