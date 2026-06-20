import { db } from "~/lib/db";
import { vacas } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

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

  const result = await db
    .update(vacas)
    .set({
      usuario_id: usuarioId,
      numero_arete: body.numero_arete,
      nombre: body.nombre,
      raza: body.raza,
      sexo: body.sexo,
      fecha_nacimiento: body.fecha_nacimiento,
      estado: body.estado ?? "activa",
      updated_at: new Date(),
    })
    .where(
      and(
        eq(vacas.id, id),
        eq(vacas.usuario_id, usuarioId)
      )
    )
    .returning();

  if (!result.length) {
    throw createError({
      statusCode: 404,
      statusMessage: "Vaca no encontrada"
    });
  }

  await rebuildVacaContext(id);

  return result[0];
});