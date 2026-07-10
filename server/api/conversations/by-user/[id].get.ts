import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const rows = await sql`SELECT * FROM conversations WHERE usuario_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ?? null;
}));
