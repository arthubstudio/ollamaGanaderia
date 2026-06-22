import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function getResumen(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return null;

  const rows = await sql`
    SELECT
      id,
      nombre,
      numero_arete,
      raza,
      sexo,
      fecha_nacimiento,
      estado
    FROM vacas
    WHERE LOWER(nombre) = LOWER(${nombre})
      AND usuario_id = ${usuarioId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}