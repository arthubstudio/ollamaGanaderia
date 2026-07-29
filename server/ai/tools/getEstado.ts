import { sql } from "~/lib/db";

export async function getEstado(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return null;

  const rows = await sql`
    SELECT
      estado
    FROM bovinos
    WHERE LOWER(nombre) = LOWER(${nombre})
      AND usuario_id = ${usuarioId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}
