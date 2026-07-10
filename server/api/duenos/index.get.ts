import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  return sql`SELECT * FROM duenos WHERE usuario_id = ${userId} ORDER BY nombre ASC`;
}));
