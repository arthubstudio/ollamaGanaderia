import { generarEmbedding } from "./embeddings";
import { sql } from "./db";

export async function guardarContextoSemantico(
  vacaId: number,
  contenido: string
) {

  const embedding = await generarEmbedding(contenido);

  const vector = `[${embedding.join(",")}]`;

  await sql`

    INSERT INTO semantic_contexts (
      bovino_id,
      owner_user_id,
      scope,
      source,
      trusted,
      contenido,
      embedding
    )
    SELECT
      b.id,
      b.usuario_id,
      'private',
      'semantic_write',
      TRUE,
      ${contenido},
      ${vector}::vector
    FROM bovinos b
    WHERE b.id = ${vacaId}

  `;

}
