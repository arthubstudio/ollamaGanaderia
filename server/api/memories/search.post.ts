import { sql } from "~/lib/db";
import { generarEmbedding } from "~/lib/embeddings";
import { requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const embedding = await generarEmbedding(requiredText(body?.pregunta, "pregunta", 4000));
  const vector = `[${embedding.join(",")}]`;
  return sql`SELECT contenido, embedding <=> ${vector}::vector AS distancia FROM memories WHERE usuario_id = ${userId} ORDER BY distancia ASC LIMIT 3`;
}));
