import { sql } from "~/lib/db";
import { apiError, requiredText, runApi } from "~/server/utils/api";
import {
  hashPassword,
  setUserSession,
  verifyPassword
} from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const body = await readBody(event);
  const email = requiredText(body?.email, "email", 150).toLowerCase();
  const password = requiredText(body?.password, "password", 200);

  const rows = await sql`
    SELECT id, nombre, email, rol, password_hash
    FROM usuarios
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `;
  const usuario = rows[0];

  if (!usuario || !verifyPassword(password, String(usuario.password_hash))) {
    apiError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Credenciales incorrectas."
    });
  }

  if (!String(usuario.password_hash).startsWith("scrypt$")) {
    await sql`
      UPDATE usuarios
      SET password_hash = ${hashPassword(password)}
      WHERE id = ${usuario.id}
    `;
  }

  setUserSession(event, Number(usuario.id));

  return {
    id: Number(usuario.id),
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };
}));
