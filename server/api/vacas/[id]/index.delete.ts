import { db } from "~/lib/db";
import { eq, and } from "drizzle-orm";
import {
  vacas,
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

  const vaca = await db
    .select()
    .from(vacas)
    .where(
      and(
        eq(vacas.id, id),
        eq(vacas.usuario_id, usuarioId)
      )
    );

  if (!vaca.length) {
    throw createError({
      statusCode: 404,
      statusMessage: "Vaca no encontrada"
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(semanticContexts).where(eq(semanticContexts.vaca_id, id));
    await tx.delete(vacunaAplicada).where(eq(vacunaAplicada.vaca_id, id));
    await tx.delete(pesos).where(eq(pesos.vaca_id, id));
    await tx.delete(enfermedades).where(eq(enfermedades.vaca_id, id));
    await tx.delete(ventas).where(eq(ventas.vaca_id, id));
    await tx.delete(historialPropiedad).where(eq(historialPropiedad.vaca_id, id));
    await tx.delete(vacas).where(eq(vacas.id, id));
  });

  return { ok: true };
});