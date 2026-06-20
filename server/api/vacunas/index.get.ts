import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export default defineEventHandler(async (event) => {

  const query =
    getQuery(event);

  const usuarioId =
    Number(query.usuario_id);

  if (!usuarioId) {
    return [];
  }

  return await sql`

    SELECT *
    FROM vacunas

    WHERE usuario_id =
      ${usuarioId}

    ORDER BY nombre ASC

  `;
});