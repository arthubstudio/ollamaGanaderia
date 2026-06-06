import { db } from "~/lib/db";
import { pesos } from "~/drizzle/schema";
import { rebuildVacaContext } from "~/lib/rebuildVacaContext";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const result = await db
    .insert(pesos)
    .values({
      vaca_id: body.vaca_id,
      peso: body.peso,
      fecha: body.fecha,
    })
    .returning();

  await rebuildVacaContext(body.vaca_id);

  return result[0];
});