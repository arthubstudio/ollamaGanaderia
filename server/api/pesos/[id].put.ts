import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);

  const result = await sql`
    UPDATE pesos
    SET
      peso = ${body.peso},
      fecha = ${body.fecha}
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0];
});