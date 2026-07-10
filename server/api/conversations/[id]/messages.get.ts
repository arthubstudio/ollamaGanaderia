import { sql } from "~/lib/db";
import { apiError, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const conversationId = requiredText(event.context.params?.id, "conversation_id", 100);
  const owner = await sql`SELECT id FROM conversations WHERE id = ${conversationId} AND usuario_id = ${userId} LIMIT 1`;
  if (!owner.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Conversacion no encontrada." });
  return sql`SELECT role, content, created_at FROM conversation_messages WHERE conversation_id = ${conversationId} ORDER BY id ASC LIMIT 100`;
}));
