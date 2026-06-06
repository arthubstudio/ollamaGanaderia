import { db } from "~/lib/db";
import { duenos } from "~/drizzle/schema";

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const result = await db
    .insert(duenos)
    .values({
      nombre: body.nombre,
      telefono: body.telefono,
      direccion: body.direccion
    })
    .returning();

  return result[0];

});