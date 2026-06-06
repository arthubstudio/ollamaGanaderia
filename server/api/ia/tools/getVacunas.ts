import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export async function getVacunas(
  nombre: string
) {

  return await sql`

    SELECT

      vc.nombre,
      va.fecha_aplicacion,
      va.veterinario

    FROM vacuna_aplicada va

    INNER JOIN vacunas vc
      ON vc.id = va.vacuna_id

    INNER JOIN vacas v
      ON v.id = va.vaca_id

    WHERE LOWER(v.nombre)
    = LOWER(${nombre})

  `;
}