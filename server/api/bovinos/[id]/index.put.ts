import { db } from "~/lib/db";
import { bovinos } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";
import { validarDatosBovino } from "~/lib/bovinoValidation";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);

  const usuarioId = Number(body.usuario_id);

  if (!id || !usuarioId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan datos para actualizar"
    });
  }

  const validacion = validarDatosBovino({
    numero_arete: String(body.numero_arete ?? ""),
    nombre: String(body.nombre ?? ""),
    raza: String(body.raza ?? ""),
    sexo: String(body.sexo ?? "")
  });

  if (!validacion.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: validacion.error
    });
  }

  const result = await db
    .update(bovinos)
    .set({
      usuario_id: usuarioId,
      numero_arete: validacion.datos.numero_arete,
      nombre: validacion.datos.nombre,
      raza: validacion.datos.raza,
      sexo: validacion.datos.sexo,
      fecha_nacimiento: body.fecha_nacimiento,
      estado: body.estado ?? "activa",
      updated_at: new Date(),
    })
    .where(
      and(
        eq(bovinos.id, id),
        eq(bovinos.usuario_id, usuarioId)
      )
    )
    .returning();

  if (!result.length) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bovino no encontrado"
    });
  }

  await rebuildBovinoContext(id);

  return result[0];
});