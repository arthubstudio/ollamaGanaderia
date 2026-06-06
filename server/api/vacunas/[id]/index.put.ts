import { db } from "~/lib/db";
import { vacunas } from "~/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);
  const body = await readBody(event);

  const result = await db
    .update(vacunas)
    .set({
      nombre: body.nombre,
      descripcion: body.descripcion,
    })
    .where(eq(vacunas.id, id))
    .returning();

  return result[0];
});