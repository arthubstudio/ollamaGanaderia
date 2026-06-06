import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async () => {

  // =====================================================
  // TOTAL VACAS
  // =====================================================

  const totalVacas = await sql`

    SELECT COUNT(*) AS total
    FROM vacas

  `;



  // =====================================================
  // VACUNAS
  // =====================================================

  const totalVacunas = await sql`

    SELECT COUNT(*) AS total
    FROM vacuna_aplicada

  `;



  // =====================================================
  // PESO PROMEDIO
  // =====================================================

  const pesoPromedio = await sql`

    SELECT
      ROUND(
        AVG(peso)::numeric,
        2
      ) AS promedio
    FROM pesos

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
      pesoPromedio[0].promedio
        ?? 0

  };

});