import { sql } from "~/lib/db";

export async function getHistorial(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return [];

  return await sql`
    SELECT
      d.nombre AS dueno_nombre,
      r.nombre AS rancho_nombre,
      hp.fecha_inicio,
      hp.fecha_fin,
      hp.observaciones
    FROM historial_propiedad hp
    INNER JOIN bovinos v
      ON v.id = hp.bovino_id
    LEFT JOIN duenos d
      ON d.id = hp.dueno_id
    LEFT JOIN ranchos r
      ON r.id = hp.rancho_id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY hp.fecha_inicio DESC, hp.id DESC
  `;
}
