import { sql } from "~/lib/db";
import { apiError, requiredText, runApi } from "~/server/utils/api";
import {
  hashPassword,
  setUserSession,
  verifyLoginPassword
} from "~/server/utils/session";
import {
  enforceRateLimit,
  getClientAddress,
  rateLimitKeyPart,
  resetRateLimit
} from "~/server/utils/rateLimit";

export default defineEventHandler(async (event) => runApi(async () => {
  const body = await readBody(event);
  const email = requiredText(body?.email, "email", 150).toLowerCase();
  const password = requiredText(body?.password, "password", 200);
  const clientAddress = getClientAddress(event);
  const identityLimitKey = `auth:login:identity:${rateLimitKeyPart(clientAddress)}:${rateLimitKeyPart(email)}`;

  await enforceRateLimit(event, {
    key: `auth:login:ip:${rateLimitKeyPart(clientAddress)}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
    message: "Se alcanzo el limite de intentos de inicio de sesion para esta conexion."
  });
  await enforceRateLimit(event, {
    key: identityLimitKey,
    limit: 5,
    windowMs: 15 * 60 * 1000,
    message: "Demasiados intentos para estas credenciales. Espera antes de intentar nuevamente."
  });

  const rows = await sql`
    SELECT id, nombre, email, rol, password_hash, security_locked_at
    FROM usuarios
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `;
  const usuario = rows[0];
  const passwordMatches = verifyLoginPassword(
    password,
    usuario ? String(usuario.password_hash) : null
  );

  if (!usuario || !passwordMatches || usuario.security_locked_at) {
    apiError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Credenciales incorrectas."
    });
  }

  if (!String(usuario.password_hash).startsWith("scrypt$")) {
    await sql`
      UPDATE usuarios
      SET password_hash = ${hashPassword(password)}, password_changed_at = NOW()
      WHERE id = ${usuario.id}
    `;
  }

  await resetRateLimit(identityLimitKey);
  await setUserSession(event, Number(usuario.id));

  return {
    id: Number(usuario.id),
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };
}));
