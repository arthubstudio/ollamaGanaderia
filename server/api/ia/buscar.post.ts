import postgres from "postgres";

import { generarEmbedding }
from "~/lib/embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const embedding = await generarEmbedding(
    body.pregunta
  );

  const vector = `[${embedding.join(",")}]`;

  const resultados = await sql`

    SELECT
      bovino_id,
      contenido,

      embedding <=> ${vector}::vector
      AS distancia

    FROM semantic_contexts

    ORDER BY distancia ASC

    LIMIT 5

  `;

  return resultados;

});