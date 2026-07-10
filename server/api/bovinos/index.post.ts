import { db } from "~/lib/db";
import { bovinos } from "~/drizzle/schema";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { validarDatosBovino } from "~/lib/bovinoValidation";
import { apiError, optionalDate, optionalText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const validacion = validarDatosBovino({
    numero_arete: String(body?.numero_arete ?? ""),
    nombre: String(body?.nombre ?? ""),
    raza: String(body?.raza ?? ""),
    sexo: String(body?.sexo ?? "")
  });

  if (!validacion.ok) {
    apiError({ statusCode: 400, code: "INVALID_BOVINO", message: validacion.error });
  }

  const estado = optionalText(body?.estado, 50) ?? "activa";
  if (!new Set(["activa", "vendida", "baja"]).has(estado.toLowerCase())) {
    apiError({ statusCode: 400, code: "INVALID_STATE", message: "El estado del bovino no es valido." });
  }

  const result = await db.insert(bovinos).values({
    usuario_id: userId,
    numero_arete: validacion.datos.numero_arete,
    nombre: validacion.datos.nombre,
    raza: validacion.datos.raza,
    sexo: validacion.datos.sexo,
    fecha_nacimiento: optionalDate(body?.fecha_nacimiento, "La fecha de nacimiento"),
    estado: estado.toLowerCase()
  }).returning();

  await rebuildBovinoContext(result[0].id);
  return result[0];
}));
