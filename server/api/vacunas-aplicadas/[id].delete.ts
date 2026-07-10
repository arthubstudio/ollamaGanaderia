import { sql } from "~/lib/db";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const rows = await sql`
    DELETE FROM vacuna_aplicada va USING bovinos b
    WHERE va.id = ${id} AND b.id = va.bovino_id AND b.usuario_id = ${userId}
    RETURNING va.bovino_id
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Vacuna aplicada no encontrada." });
  await rebuildBovinoContext(Number(rows[0].bovino_id));
  return { success: true };
}));
