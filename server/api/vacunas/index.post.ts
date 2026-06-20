import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  { prepare: false }
);

export default defineEventHandler(async (event) => {

  const body =
    await readBody(event);

  if (!body.usuario_id) {

    throw createError({
      statusCode: 400,
      statusMessage: "usuario_id requerido"
    });

  }

  const result =
    await sql`

      INSERT INTO vacunas (

        nombre,
        descripcion,
        usuario_id

      )

      VALUES (

        ${body.nombre},
        ${body.descripcion},
        ${body.usuario_id}

      )

      RETURNING *

    `;

  return result[0];

});