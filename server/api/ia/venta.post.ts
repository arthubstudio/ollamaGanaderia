import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  const nombre =
    body.nombre;



  // =====================================================
  // BUSCAR VACA
  // =====================================================

  const vaca =
    await sql`

    SELECT *
    FROM bovinos

    WHERE LOWER(nombre)
    = LOWER(${nombre})

    LIMIT 1

  `;



  if (!vaca.length) {

    return {

      lista: false,

      respuesta:
        "No encontré esa vaca."

    };

  }



  const animal =
    vaca[0];



  // =====================================================
  // PESO ACTUAL
  // =====================================================

  const pesoRows =
    await sql`

    SELECT peso

    FROM pesos

    WHERE bovino_id =
    ${animal.id}

    ORDER BY fecha DESC

    LIMIT 1

  `;



  const peso =
    Number(
      pesoRows[0]?.peso ?? 0
    );



  // =====================================================
  // VACUNAS APLICADAS
  // =====================================================

  const vacunas =
    await sql`

    SELECT

      vc.nombre

    FROM vacuna_aplicada va

    INNER JOIN vacunas vc
    ON vc.id = va.vacuna_id

    WHERE va.bovino_id =
    ${animal.id}

  `;



  const vacunasAplicadas =
    vacunas.map(
      (v: any) =>
        v.nombre.toLowerCase()
    );



  // =====================================================
  // VACUNAS OBLIGATORIAS
  // =====================================================

  const requisitos =
    await sql`

    SELECT nombre
    FROM requisitos_venta

    WHERE obligatorio = true

  `;



  const faltantes =
    requisitos.filter(
      (r: any) => {

        return !vacunasAplicadas.includes(
          r.nombre.toLowerCase()
        );

      }
    );



  // =====================================================
  // VALIDAR PESO
  // =====================================================

  const pesoMinimo =
    180;



  // =====================================================
  // NO LISTA
  // =====================================================

  if (
    faltantes.length ||
    peso < pesoMinimo
  ) {

    return {

      lista: false,

      respuesta:
`

${animal.nombre}
NO está lista para venta.

Peso actual:
${peso} kg

Peso mínimo requerido:
${pesoMinimo} kg

Vacunas faltantes:

${
  faltantes.length
    ? faltantes
      .map((v: any) =>
        `- ${v.nombre}`
      )
      .join("\n")
    : "Ninguna"
}

`

    };

  }



  // =====================================================
  // LISTA
  // =====================================================

  return {

    lista: true,

    respuesta:
`

${animal.nombre}
SÍ está lista para venta.

Peso:
${peso} kg

Todas las vacunas obligatorias están aplicadas.

`

  };

});