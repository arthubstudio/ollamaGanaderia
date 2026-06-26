import { db } from "~/lib/db";
import { pesos, bovinos } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";

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
      bovino_id: pesos.bovino_id,
    })
    .from(pesos)
    .innerJoin(bovinos, eq(pesos.bovino_id, bovinos.id))
    .where(
      and(
        eq(pesos.id, id),
        eq(bovinos.usuario_id, usuarioId)
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

  await rebuildBovinoContext(pesoExistente[0].bovino_id);

  return result[0];
});
