import { crearVacunaUsuario } from "~/lib/vacunaService";
import { apiError, optionalText, requiredText, runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";
export default defineEventHandler(async (event) => runApi(async () => {
  const userId = requireUserId(event);
  const body = await readBody(event);
  const result = await crearVacunaUsuario({
    nombre: requiredText(body?.nombre, "nombre", 100),
    descripcion: optionalText(body?.descripcion),
    usuarioId: userId
  });
  if (!result.ok) {
    apiError({
      statusCode: result.code === "DUPLICATE" ? 409 : 400,
      code: result.code,
      message: result.error
    });
  }
  return result.vacuna;
}));
