import { db } from "~/lib/db";
import { pesos, vacas } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);

  const usuarioId = Number(body.usuario_id);

  if (!id || !usuarioId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan datos"
    });
  }

  const pesoExistente = await db
    .select({
      id: pesos.id,
      vaca_id: pesos.vaca_id,
    })
    .from(pesos)
    .innerJoin(vacas, eq(pesos.vaca_id, vacas.id))
    .where(
      and(
        eq(pesos.id, id),
        eq(vacas.usuario_id, usuarioId)
      )
    );

  if (!pesoExistente.length) {
    throw createError({
      statusCode: 404,
      statusMessage: "Peso no encontrado"
    });
  }

  const result = await db
    .update(pesos)
    .set({
      peso: body.peso,
      fecha: body.fecha,
    })
    .where(eq(pesos.id, id))
    .returning();

  await rebuildVacaContext(pesoExistente[0].vaca_id);

  return result[0];
});