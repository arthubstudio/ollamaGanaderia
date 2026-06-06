import { db } from "~/lib/db";
import { ranchos } from "~/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);

  const result = await db
    .update(ranchos)
    .set({
      nombre: body.nombre,
      ubicacion: body.ubicacion,
      dueno_id: body.dueno_id,
    })
    .where(eq(ranchos.id, id))
    .returning();

  return result[0];
});