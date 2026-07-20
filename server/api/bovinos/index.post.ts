import { crearBovino } from "~/server/api/ia/tools/crearBovino";
import { apiError, optionalDate, optionalText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const estado = optionalText(body?.estado, 50) ?? "activa";
  const result = await crearBovino({
    nombre: String(body?.nombre ?? ""),
    raza: String(body?.raza ?? ""),
    breed_id: body?.breed_id ? Number(body.breed_id) : undefined,
    sexo: String(body?.sexo ?? ""),
    fecha_nacimiento: optionalDate(body?.fecha_nacimiento, "La fecha de nacimiento") ?? undefined,
    estado,
    rancho_id: body?.rancho_id ? Number(body.rancho_id) : undefined,
    dueno_id: body?.dueno_id ? Number(body.dueno_id) : undefined,
    dueno_ids: Array.isArray(body?.dueno_ids) ? body.dueno_ids.map(Number) : undefined
  }, userId);

  if (!result.ok) {
    apiError({
      statusCode: 400,
      code: result.requiresBreedCreation ? "BREED_NOT_FOUND" : "INVALID_BOVINO",
      message: result.error
    });
  }

  return result.bovino;
}));
