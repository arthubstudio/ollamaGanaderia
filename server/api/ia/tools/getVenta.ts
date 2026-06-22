import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

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
    INNER JOIN vacas v
      ON v.id = ve.vaca_id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY ve.fecha DESC, ve.id DESC
    LIMIT 1
  `;
}