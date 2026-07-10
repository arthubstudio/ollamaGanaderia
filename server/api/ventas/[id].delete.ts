import { sql } from "~/lib/db";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const rows = await sql`
    DELETE FROM ventas v USING bovinos b
    WHERE v.id = ${id} AND b.id = v.bovino_id AND b.usuario_id = ${userId}
    RETURNING v.bovino_id
  `;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Venta no encontrada." });
  await sql`UPDATE bovinos SET estado = 'activa', updated_at = NOW() WHERE id = ${rows[0].bovino_id} AND usuario_id = ${userId}`;
  return { success: true };
}));
