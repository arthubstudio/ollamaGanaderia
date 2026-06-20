import { db } from "~/lib/db";
import { pesos, vacas } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const vacaId = Number(body.vaca_id);
  const usuarioId = Number(body.usuario_id);

  if (!vacaId || !usuarioId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan datos"
    });
  }

  const vaca = await db
    .select({ id: vacas.id })
    .from(vacas)
    .where(
      and(
        eq(vacas.id, vacaId),
        eq(vacas.usuario_id, usuarioId)
      )
    );

  if (!vaca.length) {
    throw createError({
      statusCode: 403,
      statusMessage: "La vaca no pertenece al usuario"
    });
  }

  const result = await db
    .insert(pesos)
    .values({
      vaca_id: vacaId,
      peso: body.peso,
      fecha: body.fecha,
    })
    .returning();

  await rebuildVacaContext(vacaId);

  return result[0];
});