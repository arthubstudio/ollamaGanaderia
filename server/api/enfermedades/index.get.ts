import { db } from "~/lib/db";
import { enfermedades, vacas } from "~/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const vacaId = Number(query.vaca_id);
  const usuarioId = Number(query.usuario_id);

  if (!vacaId || !usuarioId) {
    return [];
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
    return [];
  }

  return await db
    .select()
    .from(enfermedades)
    .where(eq(enfermedades.vaca_id, vacaId))
    .orderBy(desc(enfermedades.fecha), desc(enfermedades.id));
});