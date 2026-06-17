import postgres from "postgres";
import { generarEmbedding } from "~/lib/embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  const embedding =
    await generarEmbedding(
      body.pregunta
    );

  const vector =
    `[${embedding.join(",")}]`;

  const rows =
    await sql`

      SELECT

        contenido,

        embedding <=> ${vector}::vector
        AS distancia

      FROM memories

      WHERE usuario_id =
      ${body.usuario_id}

      ORDER BY distancia ASC

      LIMIT 3

    `;

  return rows;

});