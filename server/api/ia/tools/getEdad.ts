import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function getEdad(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return null;

  const rows = await sql`
    SELECT
      fecha_nacimiento
    FROM bovinos
    WHERE LOWER(nombre) = LOWER(${nombre})
      AND usuario_id = ${usuarioId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}