import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const result = await sql`
    INSERT INTO vacunas (nombre, descripcion)
    VALUES (${body.nombre}, ${body.descripcion})
    RETURNING *
  `;

  return result[0];
});