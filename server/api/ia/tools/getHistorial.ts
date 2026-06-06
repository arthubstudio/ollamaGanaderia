import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function getHistorial(
  nombre: string
) {

  return await sql`

    SELECT

      d.nombre AS dueno,
      r.nombre AS rancho,
      hp.fecha_inicio,
      hp.fecha_fin

    FROM historial_propiedad hp

    INNER JOIN vacas v
      ON v.id = hp.vaca_id

    LEFT JOIN duenos d
      ON d.id = hp.dueno_id

    LEFT JOIN ranchos r
      ON r.id = hp.rancho_id

    WHERE LOWER(v.nombre)
    = LOWER(${nombre})

  `;
}