import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

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
    INNER JOIN vacas v
      ON v.id = va.vaca_id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY va.fecha_aplicacion DESC, va.id DESC
  `;
}