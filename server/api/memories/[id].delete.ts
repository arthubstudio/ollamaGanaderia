import { sql } from "~/lib/db";
import { apiError, parseId, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const rows = await sql`DELETE FROM memories WHERE id = ${id} AND usuario_id = ${userId} RETURNING id`;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Memoria no encontrada." });
  return { success: true };
}));
