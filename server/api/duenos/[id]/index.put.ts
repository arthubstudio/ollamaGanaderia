import { db } from "~/lib/db";
import { duenos } from "~/drizzle/schema";

import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {

  const id = Number(event.context.params?.id);

  const body = await readBody(event);

  const result = await db
    .update(duenos)
    .set({
      nombre: body.nombre,
      telefono: body.telefono,
      direccion: body.direccion
    })
    .where(eq(duenos.id, id))
    .returning();

  return result[0];

});