import { db } from "~/lib/db";
import { vacas } from "~/drizzle/schema";
import { and, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);

  const query = getQuery(event);
  const usuarioId = Number(query.usuario_id);

  if (!id || !usuarioId) {
    return null;
  }

  const result = await db
    .select()
    .from(vacas)
    .where(
      and(
        eq(vacas.id, id),
        eq(vacas.usuario_id, usuarioId)
      )
    );

  return result[0] ?? null;
});