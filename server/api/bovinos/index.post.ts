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
    sexo: String(body?.sexo ?? ""),
    fecha_nacimiento: optionalDate(body?.fecha_nacimiento, "La fecha de nacimiento") ?? undefined,
    estado
  }, userId);

  if (!result.ok) {
    apiError({ statusCode: 400, code: "INVALID_BOVINO", message: result.error });
  }

  return result.bovino;
}));
