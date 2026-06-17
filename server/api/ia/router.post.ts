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

function slug(text: string) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectMemoryWrite(
  text: string
) {
  const raw = (text ?? "").trim();
  const normalized = normalizeText(raw);

  const cleaned = raw
    .replace(/^recuerda que\s+/i, "")
    .replace(/^recuerda\s+/i, "")
    .trim();

  const cleanedNormalized = normalizeText(cleaned);

  if (
    /^mi vaca favorita es\s+/.test(cleanedNormalized)
  ) {
    return {
      slot: "vaca_favorita",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (
    /^mi rancho favorito es\s+/.test(cleanedNormalized)
  ) {
    return {
      slot: "rancho_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (
    /^mi proveedor favorito es\s+/.test(cleanedNormalized)
  ) {
    return {
      slot: "proveedor_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (
    /^mi dueño favorito es\s+/.test(cleanedNormalized) ||
    /^mi dueno favorito es\s+/.test(cleanedNormalized)
  ) {
    return {
      slot: "dueno_favorito",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const favoriteMatch =
    cleanedNormalized.match(
      /^mi ([a-z0-9 _-]+?) favorito(?:a)? es\s+(.+)$/
    );

  if (favoriteMatch) {
    const subject = favoriteMatch[1] ?? "preferencia";
    const subjectSlug = slug(subject);

    let slot = `${subjectSlug}_favorito`;

    if (subjectSlug.includes("vaca")) slot = "vaca_favorita";
    if (subjectSlug.includes("rancho")) slot = "rancho_favorito";
    if (subjectSlug.includes("proveedor")) slot = "proveedor_favorito";
    if (subjectSlug.includes("dueno")) slot = "dueno_favorito";

    return {
      slot,
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const genericMatch =
    cleanedNormalized.match(/^mi ([a-z0-9 _-]+?) es\s+(.+)$/);

  if (genericMatch) {
    const subject = genericMatch[1] ?? "hecho";
    return {
      slot: slug(subject),
      tipo: "hecho",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^(me gusta(?:n)?|amo|adoro)\s+/.test(cleanedNormalized)) {
    return {
      slot: "me_gusta",
      tipo: "gusto",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^(no me gusta|odio|detesto)\s+/.test(cleanedNormalized)) {
    return {
      slot: "no_me_gusta",
      tipo: "disgusto",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^prefiero\s+/.test(cleanedNormalized)) {
    return {
      slot: "preferencia",
      tipo: "preferencia",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^(soy|me llamo)\s+/.test(cleanedNormalized)) {
    return {
      slot: "identidad",
      tipo: "identidad",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^vivo en\s+/.test(cleanedNormalized)) {
    return {
      slot: "vivo_en",
      tipo: "ubicacion",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (/^trabajo en\s+/.test(cleanedNormalized)) {
    return {
      slot: "trabajo_en",
      tipo: "ocupacion",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  const relationMatch =
    cleanedNormalized.match(/^(.+?)\s+odia\s+a\s+(.+)$/);

  if (relationMatch) {
    const subject = slug(relationMatch[1] ?? "alguien");
    const target = slug(relationMatch[2] ?? "algo");

    return {
      slot: `rel_${subject}_odia_${target}`,
      tipo: "relacion",
      contenido: cleaned,
      respuesta: `Entendido, recordaré que ${cleaned}.`
    };
  }

  if (
    normalized.startsWith("recuerda que ") ||
    normalized.startsWith("recuerda ") ||
    normalized.startsWith("mi ") ||
    normalized.startsWith("me gusta") ||
    normalized.startsWith("no me gusta") ||
    normalized.startsWith("odio") ||
    normalized.startsWith("prefiero") ||
    normalized.startsWith("soy ") ||
    normalized.startsWith("me llamo") ||
    normalized.startsWith("vivo en") ||
    normalized.startsWith("trabajo en")
  ) {
    return {
      slot: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "general",
      contenido: cleaned,
      respuesta: `Entendido, recordaré: ${cleaned}.`
    };
  }

  return null;
}

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  const conversationId =
    body.conversation_id
      ? String(body.conversation_id)
      : null;

  const usuarioId =
    body.usuario_id
      ? Number(body.usuario_id)
      : null;

  const preguntaOriginal =
    body.pregunta ?? "";

  const memoryWrite =
    detectMemoryWrite(
      preguntaOriginal
    );

  if (
    usuarioId &&
    memoryWrite
  ) {

    await $fetch(
      "/api/memories/create",
      {

        method: "POST",

        body: {

          usuario_id:
            usuarioId,

          slot:
            memoryWrite.slot,

          tipo:
            memoryWrite.tipo,

          contenido:
            memoryWrite.contenido

        }

      }
    );

    return {
      tipo: "memoria",
      respuesta:
        memoryWrite.respuesta
    };

  }

  const pregunta =
    normalizeText(
      preguntaOriginal
    );

  const esPreguntaDeMemoria =
    pregunta.includes("recuerda que") ||
    pregunta.includes("recuerda") ||
    pregunta.includes("memoria") ||
    pregunta.includes("memorias") ||
    pregunta.includes("mi vaca favorita") ||
    pregunta.includes("mi rancho favorito") ||
    pregunta.includes("mi proveedor favorito") ||
    pregunta.includes("que recuerdas de mi") ||
    pregunta.includes("qué recuerdas de mi") ||
    pregunta.includes("que sabes de mi") ||
    pregunta.includes("qué sabes de mi") ||
    pregunta.includes("que sabes sobre mi") ||
    pregunta.includes("qué sabes sobre mi") ||
    pregunta.includes("mis recuerdos") ||
    pregunta.includes("favorita");

  if (esPreguntaDeMemoria) {

    const memoriaResponse =
      await $fetch(
        "/api/ia/chat",
        {
          method: "POST",
          body: {
            pregunta:
              preguntaOriginal,
            conversation_id:
              conversationId,
            usuario_id:
              usuarioId
          }
        }
      );

    return {
      tipo: "memoria",
      respuesta:
        memoriaResponse.respuesta
    };

  }

  // =====================================================
  // FILTRO GANADERO
  // =====================================================

  const palabrasGanaderas = [

    "pesa",
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

    return reply({

      tipo: "filtro",

      respuesta:
        "No encontré información relacionada en el sistema."

    });

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

      return reply({

        tipo: "sql",

        respuesta:
          "No encontré esa vaca."

      });

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

    return reply({

      tipo: "sql",

      respuesta:
        ventaResponse.respuesta

    });

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

    return reply({

      tipo: "sql",

      respuesta:
        `Tienes ${result[0].total} vacas hembras.`

    });

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

    return reply({

      tipo: "sql",

      respuesta:
        `Tienes ${result[0].total} vacas macho.`

    });

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

    return reply({

      tipo: "sql",

      respuesta:
        `Tienes ${result[0].total} vacas registradas.`

    });

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

      return reply({

        tipo: "sql",

        respuesta:
          "No hay vacas vacunadas."

      });

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

    return reply({

      tipo: "sql",

      respuesta:
        `Vacas vacunadas:\n${texto}`

    });

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

      return reply({

        tipo: "sql",

        respuesta:
          "No hay vacas registradas."

      });

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

    return reply({

      tipo: "sql",

      respuesta:
        `Vacas registradas:\n${texto}`

    });

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

    return reply({

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

    });

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

        return reply({

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

        });

      }

      const estado =
        animalMatch.estado
        ?? "activa";

      if (
        estado.toLowerCase()
        === "baja"
      ) {

        return reply({

          tipo: "sql",

          respuesta:
`${animalMatch.nombre} está dada de baja.`

        });

      }

      return reply({

        tipo: "sql",

        respuesta:
`${animalMatch.nombre} sigue activa.`

      });

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

      return reply({

        tipo: "sql",

        respuesta:
          `${animalMatch.nombre} tiene aproximadamente ${edad} años.`

      });

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

        return reply({

          tipo: "sql",

          respuesta:
            `No hay pesos registrados para ${animalMatch.nombre}.`

        });

      }

      return reply({

        tipo: "sql",

        respuesta:
          `${animalMatch.nombre} pesa ${ultimoPeso.peso} kg.`

      });

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

        return reply({

          tipo: "sql",

          respuesta:
            `El veterinario más reciente de ${animalMatch.nombre} fue ${ultima.veterinario}.`

        });

      }

      if (
        enfermedadesRows.length
      ) {

        const ultima =
          enfermedadesRows[0];

        return reply({

          tipo: "sql",

          respuesta:
            `El veterinario de ${animalMatch.nombre} fue ${ultima.veterinario}.`

        });

      }

      return reply({

        tipo: "sql",

        respuesta:
          `No hay veterinarios registrados para ${animalMatch.nombre}.`

      });

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

        return reply({

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene tratamientos registrados.`

        });

      }

      const ultima =
        enfermedadesRows[0];

      return reply({

        tipo: "sql",

        respuesta:
          `El tratamiento de ${animalMatch.nombre} fue: ${ultima.tratamiento}.`

      });

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

        return reply({

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene enfermedades registradas.`

        });

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

      return reply({

        tipo: "sql",

        respuesta:
          `Enfermedades de ${animalMatch.nombre}:\n${texto}`

      });

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

        return reply({

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene vacunas registradas.`

        });

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

      return reply({

        tipo: "sql",

        respuesta:
          `Vacunas de ${animalMatch.nombre}:\n${texto}`

      });

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

        return reply({

          tipo: "sql",

          respuesta:
            `${animalMatch.nombre} no tiene historial.`

        });

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

      return reply({

        tipo: "sql",

        respuesta:
          `Historial de ${animalMatch.nombre}:\n${texto}`

      });

    }

    // =====================================================
    // RESUMEN GENERAL
    // =====================================================

    return reply({

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

    });

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
            preguntaOriginal,

          conversation_id:
            conversationId,

          usuario_id:
            usuarioId

        }

      }
    );

  return reply({

    tipo: "rag",

    respuesta:
      ragResponse.respuesta

  });

});