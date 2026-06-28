import { db } from "~/lib/db";
import { pesos, bovinos } from "~/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const vacaId = Number(query.bovino_id);
  const usuarioId = Number(query.usuario_id);

  if (!vacaId || !usuarioId) {
    return [];
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
    return [];
  }

  return await db
    .select()
    .from(pesos)
    .where(eq(pesos.bovino_id, vacaId))
    .orderBy(desc(pesos.fecha), desc(pesos.id));
});