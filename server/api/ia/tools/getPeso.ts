import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false,
  }
);

/**
 * Obtiene el último peso registrado de una vaca.
 */
export async function getPeso(
  nombre: string
) {

  const rows = await sql`

    SELECT

      p.peso

    FROM vacas v

    INNER JOIN pesos p
      ON p.vaca_id = v.id

    WHERE LOWER(v.nombre)
    = LOWER(${nombre})

    ORDER BY p.fecha DESC

    LIMIT 1

  `;

  return rows[0] ?? null;
}