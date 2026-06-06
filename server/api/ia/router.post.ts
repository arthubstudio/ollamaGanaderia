import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

function normalizeText(
  value: string
) {

  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

}

function hasWords(
  text: string,
  words: string[]
) {

  return words.every(
    word =>
      text.includes(word)
  );

}

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  const preguntaOriginal =
    body.pregunta ?? "";

  const pregunta =
    normalizeText(
      preguntaOriginal
    );



  // =====================================================
  // FILTRO GANADERO
  // =====================================================

  const palabrasGanaderas = [

    "vaca",
    "vacas",
    "ganado",
    "peso",
    "pesos",
    "vacuna",
    "vacunas",
    "vacunada",
    "vacunadas",
    "vacunado",
    "vacunados",
    "enfermedad",
    "enfermedades",
    "rancho",
    "ranchos",
    "dueno",
    "dueño",
    "animal",
    "animales",
    "hembra",
    "hembras",
    "macho",
    "machos",
    "arete",
    "venta",
    "ventas",
    "historial",
    "propiedad",
    "veterinario",
    "tratamiento",
    "vender",
    "venta",
    "activo",
    "activa",
    "baja",
    "vendida",
    "vendido"

  ];



  const esGanadera =
    palabrasGanaderas.some(
      palabra =>
        pregunta.includes(
          palabra
        )
    );



  if (!esGanadera) {

    return {

      tipo: "filtro",

      respuesta:
        "No encontré información relacionada en el sistema."

    };

  }



  // =====================================================
  // CARGAR VACAS
  // =====================================================

  const vacas = await sql`

    SELECT *
    FROM vacas

  `;



  // =====================================================
  // DETECTAR VACA
  // =====================================================

  const animalMatch =
    vacas.find((v: any) => {

      const nombre =
        normalizeText(
          v.nombre ?? ""
        );

      const arete =
        normalizeText(
          v.numero_arete ?? ""
        );

      return (

        pregunta.includes(
          nombre
        ) ||

        pregunta.includes(
          arete
        )

      );

    }) ?? null;

  // =====================================================
  // LISTA PARA VENTA
  // =====================================================

  if (

    pregunta.includes(
      "lista para venta"
    ) ||

    pregunta.includes(
      "apta para la venta"
    ) ||

    pregunta.includes(
      "lista para la venta"
    ) ||

    pregunta.includes(
      "lista para vender"
    ) ||

    pregunta.includes(
      "apta para venta"
    ) ||

    pregunta.includes(
      "apta para vender"
    ) ||

    pregunta.includes(
      "se puede vender"
    ) ||

    pregunta.includes(
      "puede venderse"
    ) ||

    pregunta.includes(
      "ya se puede vender"
    ) ||

    pregunta.includes(
      "ya puede venderse"
    ) ||

    pregunta.includes(
      "puedo venderla"
    ) ||

    pregunta.includes(
      "puedo venderlo"
    ) ||

    pregunta.includes(
      "esta lista para venderse"
    ) ||

    pregunta.includes(
      "esta lista para venta"
    ) ||

    pregunta.includes(
      "esta apta para venta"
    ) ||

    pregunta.includes(
      "esta apta para venderse"
    ) ||

    pregunta.includes(
      "cumple requisitos de venta"
    ) ||

    pregunta.includes(
      "cumple con vacunas"
    ) ||

    pregunta.includes(
      "cumple requisitos sanitarios"
    ) ||

    pregunta.includes(
      "cumple para venta"
    ) ||

    pregunta.includes(
      "lista para comercializacion"
    ) ||

    pregunta.includes(
      "puede comercializarse"
    ) ||

    pregunta.includes(
      "ya esta vacunada para venta"
    ) ||

    pregunta.includes(
      "tiene vacunas para venta"
    ) ||

    pregunta.includes(
      "esta preparada para venta"
    ) ||

    pregunta.includes(
      "lista para salir al mercado"
    ) ||

    pregunta.includes(
      "lista para traslado"
    ) ||

    pregunta.includes(
      "lista para movilizacion"
    ) ||

    pregunta.includes(
      "puede transportarse"
    ) ||

    pregunta.includes(
      "cumple para movilizacion"
    )

  ) {

    if (!animalMatch) {

      return {

        tipo: "sql",

        respuesta:
          "No encontré esa vaca."

      };

    }



    const ventaResponse =
      await $fetch(
        "/api/ia/venta",
        {

          method: "POST",

          body: {

            nombre:
              animalMatch.nombre

          }

        }
      );



    return {

      tipo: "sql",

      respuesta:
        ventaResponse.respuesta

    };

  }



  // =====================================================
  // CONTAR HEMBRAS
  // =====================================================

  if (

    hasWords(
      pregunta,
      ["cuantas", "hembras"]
    ) ||

    hasWords(
      pregunta,
      ["cuantas", "hembra"]
    )

  ) {

    const result = await sql`

      SELECT COUNT(*) AS total
      FROM vacas

      WHERE LOWER(sexo)
      = 'hembra'

    `;

    return {

      tipo: "sql",

      respuesta:
        `Tienes ${result[0].total} vacas hembras.`

    };

  }



  // =====================================================
  // CONTAR MACHOS
  // =====================================================

  if (

    hasWords(
      pregunta,
      ["cuantos", "machos"]
    ) ||

    hasWords(
      pregunta,
      ["cuantos", "macho"]
    )

  ) {

    const result = await sql`

      SELECT COUNT(*) AS total
      FROM vacas

      WHERE LOWER(sexo)
      = 'macho'

    `;

    return {

      tipo: "sql",

      respuesta:
        `Tienes ${result[0].total} vacas macho.`

    };

  }



  // =====================================================
  // TOTAL VACAS
  // =====================================================

  if (

    hasWords(
      pregunta,
      ["cuantas", "vacas"]
    ) ||

    pregunta.includes(
      "total vacas"
    )

  ) {

    const result = await sql`

      SELECT COUNT(*) AS total
      FROM vacas

    `;

    return {

      tipo: "sql",

      respuesta:
        `Tienes ${result[0].total} vacas registradas.`

    };

  }



  // =====================================================
  // VACAS VACUNADAS
  // =====================================================

  if (

    pregunta.includes(
      "vacunada"
    ) ||

    pregunta.includes(
      "vacunadas"
    ) ||

    pregunta.includes(
      "vacunado"
    ) ||

    pregunta.includes(
      "vacunados"
    )

  ) {

    const result = await sql`

      SELECT DISTINCT

        v.nombre,
        v.numero_arete

      FROM vacas v

      INNER JOIN vacuna_aplicada va
      ON va.vaca_id = v.id

    `;

    if (!result.length) {

      return {

        tipo: "sql",

        respuesta:
          "No hay vacas vacunadas."

      };

    }

    const texto =
      result
        .map((v: any) => {

          return `
- ${v.nombre}
(${v.numero_arete})
`;

        })
        .join("\n");

    return {

      tipo: "sql",

      respuesta:
        `Vacas vacunadas:\n${texto}`

    };

  }



  // =====================================================
  // LISTAR VACAS
  // =====================================================

  if (

    pregunta.includes(
      "que vacas tengo"
    ) ||

    pregunta.includes(
      "vacas registradas"
    ) ||

    pregunta.includes(
      "listar vacas"
    ) ||

    pregunta.includes(
      "todas las vacas"
    ) ||

    pregunta.includes(
      "total de vacas"
    ) ||

    pregunta.includes(
      "que vacas hay"
    ) ||

    pregunta.includes(
      "listame las vacas "
    )

  ) {

    const result = await sql`

      SELECT

        nombre,
        raza,
        sexo,
        numero_arete

      FROM vacas

    `;

    if (!result.length) {

      return {

        tipo: "sql",

        respuesta:
          "No hay vacas registradas."

      };

    }

    const texto =
      result
        .map((v: any) => {

          return `
- ${v.nombre}
| ${v.raza}
| ${v.sexo}
| ${v.numero_arete}
`;

        })
        .join("\n");

    return {

      tipo: "sql",

      respuesta:
        `Vacas registradas:\n${texto}`

    };

  }

  // =====================================================
  // FUNCTION CALLING
  // =====================================================

  const functionResponse =
    await $fetch(
      "/api/ia/function-calling",
      {
        method: "POST",

        body: {
          pregunta:
            preguntaOriginal
        }
      }
    );



  if (
    functionResponse?.encontrado
  ) {

    return {

      tipo:
        "function-calling",

      respuesta:
        functionResponse.respuesta,

      tool:
        functionResponse.tool,

      argumentos:
        functionResponse.argumentos,

      resultado:
        functionResponse.resultado

    };

  }

  // =====================================================
  // SI EXISTE ANIMAL
  // =====================================================

  if (animalMatch) {

    const vacaId =
      animalMatch.id;



    // =====================================================
    // PESOS
    // =====================================================

    const pesosRows =
      await sql`

      SELECT
        peso,
        fecha

      FROM pesos

      WHERE vaca_id =
      ${vacaId}

      ORDER BY fecha DESC

    `;



    // =====================================================
    // VACUNAS
    // =====================================================

    const vacunasRows =
      await sql`

      SELECT

        vc.nombre
        AS vacuna_nombre,

        va.fecha_aplicacion,

        va.veterinario

      FROM vacuna_aplicada va

      LEFT JOIN vacunas vc
      ON vc.id = va.vacuna_id

      WHERE va.vaca_id =
      ${vacaId}

      ORDER BY
      va.fecha_aplicacion DESC

    `;



    // =====================================================
    // ENFERMEDADES
    // =====================================================

    const enfermedadesRows =
      await sql`

      SELECT

        nombre,
        tratamiento,
        fecha,
        veterinario

      FROM enfermedades

      WHERE vaca_id =
      ${vacaId}

      ORDER BY fecha DESC

    `;



    // =====================================================
    // HISTORIAL
    // =====================================================

    const historialRows =
      await sql`

      SELECT

        hp.fecha_inicio,

        hp.fecha_fin,

        d.nombre
        AS dueno_nombre,

        r.nombre
        AS rancho_nombre

      FROM historial_propiedad hp

      LEFT JOIN duenos d
      ON d.id = hp.dueno_id

      LEFT JOIN ranchos r
      ON r.id = hp.rancho_id

      WHERE hp.vaca_id =
      ${vacaId}

      ORDER BY hp.fecha_inicio DESC

    `;



    const ultimoPeso =
      pesosRows[0] ?? null;

    const propiedadActual =
      historialRows[0] ?? null;



    // =====================================================
    // ESTADO ACTUAL
    // =====================================================

    if (

      pregunta.includes(
        "esta activa"
      ) ||

      pregunta.includes(
        "sigue activa"
      ) ||

      pregunta.includes(
        "esta dada de baja"
      ) ||

      pregunta.includes(
        "esta de baja"
      ) ||

      pregunta.includes(
        "ya se vendio"
      ) ||

      pregunta.includes(
        "ya fue vendida"
      ) ||

      pregunta.includes(
        "fue vendida"
      ) ||

      pregunta.includes(
        "esta vendida"
      ) ||

      pregunta.includes(
        "se vendio"
      ) ||

      pregunta.includes(
        "vendida"
      ) ||

      pregunta.includes(
        "vendido"
      )

    ) {

      const ventaRows =
        await sql`

        SELECT *

        FROM ventas

        WHERE vaca_id =
        ${vacaId}

        ORDER BY fecha DESC

        LIMIT 1

      `;



      const venta =
        ventaRows[0] ?? null;



      if (venta) {

        return {

          tipo: "sql",

          respuesta:
`

${animalMatch.nombre}
ya fue vendida.

Comprador:
${venta.comprador}

Precio:
$${venta.precio}

Fecha:
${venta.fecha}

`

        };

      }



      const estado =
        animalMatch.estado
        ?? "activa";



      if (
        estado.toLowerCase()
        === "baja"
      ) {

        return {

          tipo: "sql",

          respuesta:
`${animalMatch.nombre} está dada de baja.`

        };

      }



      return {

        tipo: "sql",

        respuesta:
`${animalMatch.nombre} sigue activa.`

      };

    }



    // =====================================================
    // EDAD
    // =====================================================

    if (

      pregunta.includes(
        "edad"
      ) ||

      pregunta.includes(
        "años"
      )

    ) {

      const nacimiento =
        new Date(
          animalMatch.fecha_nacimiento
        );

      const hoy =
        new Date();

      const edad =
        hoy.getFullYear() -
        nacimiento.getFullYear();

      return {

        tipo: "sql",

        respuesta:
          `${animalMatch.nombre} tiene aproximadamente ${edad} años.`

      };

    }



    // =====================================================
    // PESO
    // =====================================================

    if (

      pregunta.includes(
        "peso"
      ) ||

      pregunta.includes(
        "pesa"
      )

    ) {

      if (!ultimoPeso) {

        return {

          tipo: "sql",

          respuesta:
            `No hay pesos registrados para ${animalMatch.nombre}.`

        };

      }

      return {

        tipo: "sql",

        respuesta:
          `${animalMatch.nombre} pesa ${ultimoPeso.peso} kg.`

      };

    }



    // =====================================================
    // VETERINARIO
    // =====================================================

    if (

      pregunta.includes(
        "veterinario"
      )

    ) {

      if (
        vacunasRows.length
      ) {

        const ultima =
          vacunasRows[0];

        return {

          tipo: "sql",

          respuesta:
            `El veterinario más reciente de ${animalMatch.nombre} fue ${ultima.veterinario}.`

        };

      }



      if (
        enfermedadesRows.length
      ) {

        const ultima =
          enfermedadesRows[0];

        return {

          tipo: "sql",

          respuesta:
            `El veterinario de ${animalMatch.nombre} fue ${ultima.veterinario}.`

        };

      }



      return {

        tipo: "sql",

        respuesta:
          `No hay veterinarios registrados para ${animalMatch.nombre}.`

      };

    }



    // =====================================================
    // TRATAMIENTO
    // =====================================================

    if (

      pregunta.includes(
        "tratamiento"
      )

    ) {

      if (
        !enfermedadesRows.length
      ) {

        return {

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene tratamientos registrados.`

        };

      }

      const ultima =
        enfermedadesRows[0];

      return {

        tipo: "sql",

        respuesta:
          `El tratamiento de ${animalMatch.nombre} fue: ${ultima.tratamiento}.`

      };

    }



    // =====================================================
    // ENFERMEDADES
    // =====================================================

    if (

      pregunta.includes(
        "enfermedad"
      ) ||

      pregunta.includes(
        "enfermedades"
      )

    ) {

      if (
        !enfermedadesRows.length
      ) {

        return {

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene enfermedades registradas.`

        };

      }

      const texto =
        enfermedadesRows
          .map((e: any) => {

            return `
- ${e.nombre}
(${e.fecha})
`;

          })
          .join("\n");

      return {

        tipo: "sql",

        respuesta:
          `Enfermedades de ${animalMatch.nombre}:\n${texto}`

      };

    }



    // =====================================================
    // VACUNAS
    // =====================================================

    if (

      pregunta.includes(
        "vacuna"
      ) ||

      pregunta.includes(
        "vacunas"
      )

    ) {

      if (
        !vacunasRows.length
      ) {

        return {

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene vacunas registradas.`

        };

      }

      const texto =
        vacunasRows
          .map((v: any) => {

            return `
- ${v.vacuna_nombre}
(${v.fecha_aplicacion})
Veterinario:
${v.veterinario}
`;

          })
          .join("\n");

      return {

        tipo: "sql",

        respuesta:
          `Vacunas de ${animalMatch.nombre}:\n${texto}`

      };

    }



    // =====================================================
    // HISTORIAL
    // =====================================================

    if (

      pregunta.includes(
        "historial"
      )

    ) {

      if (
        !historialRows.length
      ) {

        return {

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene historial.`

        };

      }

      const texto =
        historialRows
          .map((h: any) => {

            return `
Dueño:
${h.dueno_nombre}

Rancho:
${h.rancho_nombre}

Desde:
${h.fecha_inicio}

Hasta:
${h.fecha_fin ?? "Actual"}
`;

          })
          .join("\n");

      return {

        tipo: "sql",

        respuesta:
          `Historial de ${animalMatch.nombre}:\n${texto}`

      };

    }



    // =====================================================
    // RESUMEN GENERAL
    // =====================================================

    return {

      tipo: "sql",

      respuesta:
`

Nombre:
${animalMatch.nombre}

Arete:
${animalMatch.numero_arete}

Raza:
${animalMatch.raza}

Sexo:
${animalMatch.sexo}

Estado:
${animalMatch.estado ?? "activa"}

Dueño actual:
${propiedadActual?.dueno_nombre ?? "Sin dueño"}

Rancho actual:
${propiedadActual?.rancho_nombre ?? "Sin rancho"}

Último peso:
${ultimoPeso
  ? `${ultimoPeso.peso} kg`
  : "Sin peso"}

Vacunas registradas:
${vacunasRows.length}

Enfermedades registradas:
${enfermedadesRows.length}

`

    };

  }

  // =====================================================
  // FALLBACK RAG
  // =====================================================

  const ragResponse =
    await $fetch(
      "/api/ia/chat",
      {

        method: "POST",

        body: {
          pregunta:
            preguntaOriginal
        }

      }
    );



  return {

    tipo: "rag",

    respuesta:
      ragResponse.respuesta

  };

});