import postgres from "postgres";
import { generarEmbedding } from "./embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

function calcularEdad(fechaNacimiento: string | Date | null) {

  if (!fechaNacimiento) {
    return null;
  }

  const nacimiento =
    new Date(fechaNacimiento);

  const hoy =
    new Date();

  let edad =
    hoy.getFullYear() -
    nacimiento.getFullYear();

  const m =
    hoy.getMonth() -
    nacimiento.getMonth();

  if (
    m < 0 ||
    (
      m === 0 &&
      hoy.getDate() <
      nacimiento.getDate()
    )
  ) {

    edad--;

  }

  return edad;

}

export async function rebuildVacaContext(
  vacaId: number
) {

  const vacaRows =
    await sql`

      SELECT *

      FROM vacas

      WHERE id = ${vacaId}

      LIMIT 1

    `;

  if (!vacaRows.length) {
    return;
  }

  const vaca =
    vacaRows[0];



  // =====================================================
  // PESOS
  // =====================================================

  const pesos =
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

  const vacunas =
    await sql`

      SELECT

        vc.nombre,
        va.fecha_aplicacion,
        va.veterinario

      FROM vacuna_aplicada va

      LEFT JOIN vacunas vc
      ON vc.id = va.vacuna_id

      WHERE va.vaca_id =
      ${vacaId}

      ORDER BY va.fecha_aplicacion DESC

    `;



  // =====================================================
  // ENFERMEDADES
  // =====================================================

  const enfermedades =
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

  const historial =
    await sql`

      SELECT

        d.nombre
        AS dueno_nombre,

        r.nombre
        AS rancho_nombre,

        hp.fecha_inicio,
        hp.fecha_fin

      FROM historial_propiedad hp

      LEFT JOIN duenos d
      ON d.id = hp.dueno_id

      LEFT JOIN ranchos r
      ON r.id = hp.rancho_id

      WHERE hp.vaca_id =
      ${vacaId}

      ORDER BY hp.fecha_inicio DESC

    `;



  // =====================================================
  // VENTAS
  // =====================================================

  const ventas =
    await sql`

      SELECT

        comprador,
        precio,
        fecha

      FROM ventas

      WHERE vaca_id =
      ${vacaId}

      ORDER BY fecha DESC

    `;



  const ultimoPeso =
    pesos[0];



  const edad =
    calcularEdad(
      vaca.fecha_nacimiento
    );



  const contexto = `

ANIMAL REGISTRADO

Nombre:
${vaca.nombre}

Número de arete:
${vaca.numero_arete}

Arete:
${vaca.numero_arete}

Raza:
${vaca.raza}

Sexo:
${vaca.sexo}

Estado:
${vaca.estado}

Fecha nacimiento:
${vaca.fecha_nacimiento}

Edad:
${edad ?? "No disponible"} años

Peso actual:
${ultimoPeso?.peso ?? "No registrado"} kg

Dueño actual:
${historial[0]?.dueno_nombre ?? "Sin dueño"}

Rancho actual:
${historial[0]?.rancho_nombre ?? "Sin rancho"}

Historial de pesos:

${pesos
  .map(
    p =>
      `${p.peso} kg (${p.fecha})`
  )
  .join("\n")}

Vacunas:

${vacunas
  .map(
    v => `
${v.nombre}
Fecha:
${v.fecha_aplicacion}
Veterinario:
${v.veterinario}
`
  )
  .join("\n")}

Enfermedades:

${enfermedades
  .map(
    e => `
${e.nombre}

Tratamiento:
${e.tratamiento}

Veterinario:
${e.veterinario}

Fecha:
${e.fecha}
`
  )
  .join("\n")}

Historial de propietarios:

${historial
  .map(
    h => `
Dueño:
${h.dueno_nombre}

Rancho:
${h.rancho_nombre}

Desde:
${h.fecha_inicio}

Hasta:
${h.fecha_fin ?? "Actual"}
`
  )
  .join("\n")}

Ventas:

${ventas
  .map(
    v => `
Comprador:
${v.comprador}

Precio:
${v.precio}

Fecha:
${v.fecha}
`
  )
  .join("\n")}

`;



  const embedding =
    await generarEmbedding(
      contexto
    );



  const vector =
    `[${embedding.join(",")}]`;



  await sql`

    DELETE FROM semantic_contexts

    WHERE vaca_id =
    ${vacaId}

  `;



  await sql`

    INSERT INTO semantic_contexts (

      vaca_id,
      contenido,
      embedding,
      updated_at

    )

    VALUES (

      ${vacaId},
      ${contexto},
      ${vector}::vector,
      NOW()

    )

  `;

}