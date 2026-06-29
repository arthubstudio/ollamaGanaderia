import { db } from "~/lib/db";
import { pesos, bovinos } from "~/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { rebuildBovinoContext } from "~/lib/rebuildBovinoContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const bovinoId = Number(body.bovino_id);
  const usuarioId = Number(body.usuario_id);

  if (!bovinoId || !usuarioId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan datos"
    });
  }

  const bovino = await db
    .select({ id: bovinos.id })
    .from(bovinos)
    .where(
      and(
        eq(bovinos.id, bovinoId),
        eq(bovinos.usuario_id, usuarioId)
      )
    );

  if (!bovino.length) {
    throw createError({
      statusCode: 403,
      statusMessage: "El bovino no pertenece al usuario."
    });
  }

  const ultimoPeso = await db
    .select()
    .from(pesos)
    .where(eq(pesos.bovino_id, bovinoId))
    .orderBy(desc(pesos.fecha), desc(pesos.id))
    .limit(1);

  let result;

  if (ultimoPeso.length) {
    result = await db
      .update(pesos)
      .set({
        peso: body.peso,
        fecha: body.fecha
      })
      .where(eq(pesos.id, ultimoPeso[0].id))
      .returning();
  } else {
    result = await db
      .insert(pesos)
      .values({
        bovino_id: bovinoId,
        peso: body.peso,
        fecha: body.fecha
      })
      .returning();
  }

  await rebuildBovinoContext(bovinoId);

  return result[0];
});