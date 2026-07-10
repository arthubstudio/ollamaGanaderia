import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const rows = await sql`
    DELETE FROM pesos p USING bovinos b
    WHERE p.id = ${id} AND b.id = p.bovino_id AND b.usuario_id = ${userId}
    RETURNING p.bovino_id
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Peso no encontrado." });
  await rebuildBovinoContext(Number(rows[0].bovino_id));
  return { success: true };
}));
