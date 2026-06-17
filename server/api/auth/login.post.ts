import postgres from "postgres";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const usuario = await sql`

    SELECT *

    FROM usuarios

    WHERE email = ${body.email}

    LIMIT 1

  `;

  if (!usuario.length) {

    throw createError({

      statusCode: 401,

      statusMessage:
        "Usuario no encontrado"

    });

  }

  if (
    usuario[0].password_hash !==
    body.password
  ) {

    throw createError({

      statusCode: 401,

      statusMessage:
        "Contraseña incorrecta"

    });

  }

  return {

    id:
      usuario[0].id,

    nombre:
      usuario[0].nombre,

    email:
      usuario[0].email,

    rol:
      usuario[0].rol

  };

});