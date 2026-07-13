import { sql } from "~/lib/db";
import { apiError, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  const userId = requireUserId(event);

  const rows = await sql`
    SELECT id, nombre, email, rol
    FROM usuarios
    WHERE id = ${userId}
    LIMIT 1
  `;

  const usuario = rows[0];
  if (!usuario) {
    apiError({
      statusCode: 401,
      code: "UNAUTHENTICATED",
      message: "Sesion invalida."
    });
  }

  return {
    id: Number(usuario.id),
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };
}));
