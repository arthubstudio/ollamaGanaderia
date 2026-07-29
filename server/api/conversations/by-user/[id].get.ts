import { sql } from "~/lib/db";
import { apiError, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const requestedIdText = getRouterParam(event, "id") ?? "";
  if (!/^\d+$/.test(requestedIdText) || Number(requestedIdText) <= 0) {
    apiError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "La ruta solicitada no existe."
    });
  }
  if (Number(requestedIdText) !== userId) {
    apiError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "No puedes consultar conversaciones de otro usuario."
    });
  }
  const rows = await sql`SELECT * FROM conversations WHERE usuario_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ?? null;
}));
