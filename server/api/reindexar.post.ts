import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
import { enforceRateLimit } from "~/server/utils/rateLimit";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  await enforceRateLimit(event, {
    key: `ia:reindex:user:${userId}`,
    limit: 1,
    windowMs: 10 * 60 * 1000,
    message: "La reindexacion solo puede iniciarse una vez cada 10 minutos."
  });
  const totals = await sql`
    SELECT COUNT(*)::int AS total
    FROM bovinos
    WHERE usuario_id = ${userId}
  `;
  if (Number(totals[0]?.total ?? 0) > 250) {
    apiError({
      statusCode: 409,
      code: "REINDEX_BATCH_REQUIRED",
      message: "La cuenta supera 250 bovinos. Ejecuta la reindexacion por lotes desde mantenimiento."
    });
  }
  const bovinos = await sql`SELECT id FROM bovinos WHERE usuario_id = ${userId}`;
  for (const bovino of bovinos) await rebuildBovinoContext(Number(bovino.id));
  return { success: true, total: bovinos.length };
}));
