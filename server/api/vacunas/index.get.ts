import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export default defineEventHandler(async () => {
  return await sql`
    SELECT *
    FROM vacunas
    ORDER BY nombre ASC
  `;
});