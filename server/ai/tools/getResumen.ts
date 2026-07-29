import { sql } from "~/lib/db";

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
    FROM bovinos
    WHERE LOWER(nombre) = LOWER(${nombre})
      AND usuario_id = ${usuarioId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}
