import { sql } from "~/lib/db";

export async function getPeso(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return null;

  const rows = await sql`
    SELECT
      p.peso,
      p.fecha
    FROM bovinos v
    INNER JOIN pesos p
      ON p.bovino_id = v.id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY p.fecha DESC, p.id DESC
    LIMIT 1
  `;

  return rows[0] ?? null;
}
