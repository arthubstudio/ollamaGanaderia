import { randomUUID } from "node:crypto";
import { sql } from "~/lib/db";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = randomUUID();
  await sql`INSERT INTO conversations (id, usuario_id) VALUES (${id}, ${userId})`;
  return { conversation_id: id };
}));
