import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  return sql`
    SELECT * FROM ai_logs
    WHERE session_id = ${`user:${userId}`}
       OR session_id IN (SELECT id::text FROM conversations WHERE usuario_id = ${userId})
    ORDER BY id DESC LIMIT 100
  `;
}));
