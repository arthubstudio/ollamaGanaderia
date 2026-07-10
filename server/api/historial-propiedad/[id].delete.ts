import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const rows = await sql`
    DELETE FROM historial_propiedad hp USING bovinos b
    WHERE hp.id = ${id} AND b.id = hp.bovino_id AND b.usuario_id = ${userId}
    RETURNING hp.bovino_id
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Historial no encontrado." });
  await rebuildBovinoContext(Number(rows[0].bovino_id));
  return { success: true };
}));
