import { db } from "~/lib/db";
import { eq, and } from "drizzle-orm";
import {
  bovinos,
  pesos,
  vacunaAplicada,
  enfermedades,
  historialPropiedad,
  ventas,
  semanticContexts,
} from "~/drizzle/schema";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const query = getQuery(event);
  const usuarioId = Number(query.usuario_id);

  if (!id || !usuarioId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Faltan datos para eliminar"
    });
  }

  const bovino = await db
    .select()
    .from(bovinos)
    .where(
      and(
        eq(bovinos.id, id),
        eq(bovinos.usuario_id, usuarioId)
      )
    );

  if (!bovino.length) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bovino no encontrado"
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(semanticContexts).where(eq(semanticContexts.bovino_id, id));
    await tx.delete(vacunaAplicada).where(eq(vacunaAplicada.bovino_id, id));
    await tx.delete(pesos).where(eq(pesos.bovino_id, id));
    await tx.delete(enfermedades).where(eq(enfermedades.bovino_id, id));
    await tx.delete(ventas).where(eq(ventas.bovino_id, id));
    await tx.delete(historialPropiedad).where(eq(historialPropiedad.bovino_id, id));
    await tx.delete(bovinos).where(eq(bovinos.id, id));
  });

  return { ok: true };
});
