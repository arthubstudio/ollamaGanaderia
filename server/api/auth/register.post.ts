import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const existe = await sql`

    SELECT id

    FROM usuarios

    WHERE email = ${body.email}

    LIMIT 1

  `;

  if (existe.length) {

    throw createError({

      statusCode: 400,

      statusMessage:
        "El correo ya existe"

    });

  }

  const usuario = await sql`

    INSERT INTO usuarios (

      nombre,
      email,
      password_hash

    )

    VALUES (

      ${body.nombre},
      ${body.email},
      ${body.password}

    )

    RETURNING *

  `;

  return usuario[0];

});