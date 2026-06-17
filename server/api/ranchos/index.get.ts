import { db } from "~/lib/db";
import { ranchos } from "~/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {

  const query =
    getQuery(event);

  const usuarioId =
    Number(
      query.usuario_id
    );

  if (!usuarioId) {
    return [];
  }

  return await db
    .select()
    .from(ranchos)
    .where(
      eq(
        ranchos.usuario_id,
        usuarioId
      )
    );

});