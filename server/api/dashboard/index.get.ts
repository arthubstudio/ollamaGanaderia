import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const query =
    getQuery(event);

  const usuarioId =
    Number(
      query.usuario_id
    );

  if (!usuarioId) {

    return {

      totalVacas: 0,
      vacunasAplicadas: 0,
      pesoPromedio: 0

    };

  }

  // =====================================================
  // TOTAL VACAS DEL USUARIO
  // =====================================================

  const totalVacas = await sql`

    SELECT COUNT(*) AS total

    FROM vacas

    WHERE usuario_id =
    ${usuarioId}

  `;

  // =====================================================
  // VACUNAS DEL USUARIO
  // =====================================================

  const totalVacunas = await sql`

    SELECT COUNT(*) AS total

    FROM vacuna_aplicada va

    INNER JOIN vacas v
    ON v.id = va.vaca_id

    WHERE v.usuario_id =
    ${usuarioId}

  `;

  // =====================================================
  // PESO PROMEDIO DEL USUARIO
  // =====================================================

  const pesoPromedio = await sql`

    SELECT

      ROUND(
        AVG(p.peso)::numeric,
        2
      ) AS promedio

    FROM pesos p

    INNER JOIN vacas v
    ON v.id = p.vaca_id

    WHERE v.usuario_id =
    ${usuarioId}

  `;

  return {

    totalVacas:
      Number(
        totalVacas[0].total
      ),

    vacunasAplicadas:
      Number(
        totalVacunas[0].total
      ),

    pesoPromedio:
      Number(
        pesoPromedio[0].promedio ?? 0
      )

  };

});