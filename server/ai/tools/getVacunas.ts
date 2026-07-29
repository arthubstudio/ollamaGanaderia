import { sql } from "~/lib/db";

export async function getVacunas(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return [];

  return await sql`
    SELECT
      vc.nombre AS vacuna_nombre,
      va.fecha_aplicacion,
      va.veterinario,
      va.observaciones
    FROM vacuna_aplicada va
    INNER JOIN vacunas vc
      ON vc.id = va.vacuna_id
    INNER JOIN bovinos v
      ON v.id = va.bovino_id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY va.fecha_aplicacion DESC, va.id DESC
  `;
}
