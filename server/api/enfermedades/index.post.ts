import { db } from "~/lib/db";
import { enfermedades, vacas } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const vacaId = Number(body.bovino_id);
  const usuarioId = Number(body.usuario_id);

  if (!vacaId || !usuarioId) {
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
    .insert(enfermedades)
    .values({
      bovino_id: vacaId,
      nombre: body.nombre,
      tratamiento: body.tratamiento,
      fecha: body.fecha,
      veterinario: body.veterinario,
    })
    .returning();

  await rebuildBovinoContext(vacaId);

  return result[0];
});