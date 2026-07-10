import { sql } from "~/lib/db";
import { generarEmbedding } from "~/lib/embeddings";
import { requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const embedding = await generarEmbedding(requiredText(body?.pregunta, "pregunta", 4000));
  const vector = `[${embedding.join(",")}]`;
  return sql`
    SELECT sc.bovino_id, sc.contenido, sc.embedding <=> ${vector}::vector AS distancia
    FROM semantic_contexts sc JOIN bovinos b ON b.id = sc.bovino_id
    WHERE b.usuario_id = ${userId}
    ORDER BY distancia ASC LIMIT 5
  `;
}));
