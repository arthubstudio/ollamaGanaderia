import { sql } from "~/lib/db";
import { setResponseStatus } from "h3";
import { apiError, requiredText, runApi } from "~/server/utils/api";
import { hashPassword } from "~/server/utils/session";
import { ensureRequiredSaleVaccines } from "~/lib/vacunaService";
import {
  enforceRateLimit,
  getClientAddress,
  rateLimitKeyPart
} from "~/server/utils/rateLimit";
import { assertStrongPassword } from "~/server/utils/passwordPolicy";

export default defineEventHandler(async (event) => runApi(async () => {
  const body = await readBody(event);
  const nombre = requiredText(body?.nombre, "nombre", 100);
  const email = requiredText(body?.email, "email", 150).toLowerCase();
  const password = requiredText(body?.password, "password", 200);

  await enforceRateLimit(event, {
    key: `auth:register:ip:${rateLimitKeyPart(getClientAddress(event))}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
    message: "Se alcanzo el limite de registros para esta conexion."
  });

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    apiError({ statusCode: 400, code: "INVALID_EMAIL", message: "El correo no es valido." });
  }
  assertStrongPassword(password, [nombre, email, email.split("@")[0] ?? ""]);

  const passwordHash = hashPassword(password);
  await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO usuarios (nombre, email, password_hash, rol, password_changed_at)
      VALUES (${nombre}, ${email}, ${passwordHash}, 'usuario', NOW())
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;
    if (rows[0]?.id) {
      await ensureRequiredSaleVaccines(Number(rows[0].id), tx);
    }
  });

  setResponseStatus(event, 202);
  return {
    success: true,
    message: "Si los datos son validos, el registro fue procesado. Ya puedes intentar iniciar sesion."
  };
}));
