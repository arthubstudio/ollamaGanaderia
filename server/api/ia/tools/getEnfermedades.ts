import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function getEnfermedades(
  nombre: string,
  usuarioId?: number | null
) {
  if (!usuarioId) return [];

  return await sql`
    SELECT
      e.nombre,
      e.tratamiento,
      e.fecha,
      e.veterinario
    FROM enfermedades e
    INNER JOIN vacas v
      ON v.id = e.vaca_id
    WHERE LOWER(v.nombre) = LOWER(${nombre})
      AND v.usuario_id = ${usuarioId}
    ORDER BY e.fecha DESC, e.id DESC
  `;
}