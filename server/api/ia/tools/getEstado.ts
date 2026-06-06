import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function getEstado(
  nombre: string
) {

  const rows = await sql`

    SELECT
      estado

    FROM vacas

    WHERE LOWER(nombre)
    = LOWER(${nombre})

    LIMIT 1

  `;

  return rows[0] ?? null;
}