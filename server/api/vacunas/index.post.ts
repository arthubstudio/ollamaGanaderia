import { crearVacunaUsuario } from "~/lib/vacunaService";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const usuarioId = Number(body.usuario_id);

  if (!usuarioId) {
    throw createError({
      statusCode: 400,
      statusMessage: "usuario_id requerido"
    });
  }

  try {
    const result = await crearVacunaUsuario({
      nombre: String(body.nombre ?? ""),
      descripcion: body.descripcion ?? null,
      usuarioId
    });

    if (!result.ok) {
      throw createError({
        statusCode: result.code === "DUPLICATE" ? 409 : 400,
        statusMessage: result.error
      });
    }

    return result.vacuna;
  } catch (error: any) {
    if (error?.statusCode) throw error;

    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo guardar la vacuna. Intenta de nuevo."
    });
  }
});
