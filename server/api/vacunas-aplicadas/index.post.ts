import { db } from "~/lib/db";
import { vacas, vacunaAplicada } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const vacaId = Number(body.bovino_id);
  const usuarioId = Number(body.usuario_id);
  const vacunaId = Number(body.vacuna_id);

  if (!vacaId || !usuarioId || !vacunaId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan datos"
    });
  }

  const vaca = await db
    .select({ id: bovinos.id })
    .from(bovinos)
    .where(
      and(
        eq(bovinos.id, vacaId),
        eq(bovinos.usuario_id, usuarioId)
      )
    );

  if (!vaca.length) {
    throw createError({
      statusCode: 403,
      statusMessage: "La vaca no pertenece al usuario"
    });
  }

  const result = await db
    .insert(vacunaAplicada)
    .values({
      bovino_id: vacaId,
      vacuna_id: vacunaId,
      fecha_aplicacion: body.fecha_aplicacion,
      veterinario: body.veterinario,
      observaciones: body.observaciones,
    })
    .returning();

  await rebuildBovinoContext(vacaId);

  return result[0];
});