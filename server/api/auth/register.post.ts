import { sql } from "~/lib/db";
import { apiError, requiredText, runApi } from "~/server/utils/api";
import { hashPassword } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const body = await readBody(event);
  const nombre = requiredText(body?.nombre, "nombre", 100);
  const email = requiredText(body?.email, "email", 150).toLowerCase();
  const password = requiredText(body?.password, "password", 200);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    apiError({ statusCode: 400, code: "INVALID_EMAIL", message: "El correo no es valido." });
  }
  if (password.length < 6) {
    apiError({ statusCode: 400, code: "WEAK_PASSWORD", message: "La contrasena debe tener al menos 6 caracteres." });
  }

  const rows = await sql`
    INSERT INTO usuarios (nombre, email, password_hash, rol)
    VALUES (${nombre}, ${email}, ${hashPassword(password)}, 'usuario')
    RETURNING id, nombre, email, rol, created_at
  `;

  return rows[0];
}));
