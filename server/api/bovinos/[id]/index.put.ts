import { and, eq } from "drizzle-orm";
import { bovinos } from "~/drizzle/schema";
import { db } from "~/lib/db";
import { validarDatosBovino } from "~/lib/bovinoValidation";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { apiError, optionalDate, optionalText, parseId, runApi } from "~/server/utils/api";
import { requireOwnedBovino } from "~/server/utils/ownership";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const id = parseId(event.context.params?.id);
  const body = await readBody(event);
  await requireOwnedBovino(id, userId);

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

  const result = await db.update(bovinos).set({
    numero_arete: validacion.datos.numero_arete,
    nombre: validacion.datos.nombre,
    raza: validacion.datos.raza,
    sexo: validacion.datos.sexo,
    fecha_nacimiento: optionalDate(body?.fecha_nacimiento, "La fecha de nacimiento"),
    estado: estado.toLowerCase(),
    updated_at: new Date()
  }).where(and(eq(bovinos.id, id), eq(bovinos.usuario_id, userId))).returning();

  await rebuildBovinoContext(id);
  return result[0];
}));
