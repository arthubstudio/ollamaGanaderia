import { sql } from "~/lib/db";

export async function getVenta(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return [];

  return await sql`
    SELECT
      ve.comprador,
      ve.precio,
      ve.fecha,
      ve.observaciones
    FROM ventas ve
    INNER JOIN bovinos v
      ON v.id = ve.bovino_id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY ve.fecha DESC, ve.id DESC
    LIMIT 1
  `;
}
