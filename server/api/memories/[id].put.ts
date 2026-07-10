import { sql } from "~/lib/db";
import { generarEmbeddingSafe } from "~/lib/embeddings";
import { apiError, optionalText, parseId, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  const contenido = requiredText(body?.contenido, "contenido", 5000);
  const embedding = await generarEmbeddingSafe(contenido);
  const rows = embedding
    ? await sql`UPDATE memories SET contenido = ${contenido}, tipo = ${optionalText(body?.tipo, 100) ?? "general"}, embedding = ${`[${embedding.join(",")}]`}::vector, updated_at = NOW() WHERE id = ${id} AND usuario_id = ${userId} RETURNING id, slot, tipo, contenido, created_at, updated_at`
    : await sql`UPDATE memories SET contenido = ${contenido}, tipo = ${optionalText(body?.tipo, 100) ?? "general"}, updated_at = NOW() WHERE id = ${id} AND usuario_id = ${userId} RETURNING id, slot, tipo, contenido, created_at, updated_at`;
  if (!rows.length) apiError({ statusCode: 404, code: "NOT_FOUND", message: "Memoria no encontrada." });
  return rows[0];
}));
