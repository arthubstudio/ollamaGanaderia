import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const usuarioId =
    Number(
      event.context.params?.id
    );

  const rows = await sql`

    SELECT *

    FROM conversations

    WHERE usuario_id =
    ${usuarioId}

    ORDER BY created_at DESC

    LIMIT 1

  `;

  return rows[0] ?? null;

});