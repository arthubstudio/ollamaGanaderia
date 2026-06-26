import postgres from "postgres";

import { generarEmbedding } from "./embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function guardarContextoSemantico(
  vacaId: number,
  contenido: string
) {

  const embedding = await generarEmbedding(contenido);

  const vector = `[${embedding.join(",")}]`;

  await sql`

    INSERT INTO semantic_contexts
    (bovino_id, contenido, embedding)

    VALUES (
      ${vacaId},
      ${contenido},
      ${vector}::vector
    )

  `;

}