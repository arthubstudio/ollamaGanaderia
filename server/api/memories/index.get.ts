import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  return sql`SELECT id, slot, tipo, contenido, created_at, updated_at FROM memories WHERE usuario_id = ${userId} ORDER BY updated_at DESC, id DESC`;
}));
