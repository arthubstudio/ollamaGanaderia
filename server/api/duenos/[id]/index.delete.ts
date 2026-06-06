import { db } from "~/lib/db";
import { duenos } from "~/drizzle/schema";

import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {

  const id = Number(event.context.params?.id);

  const result = await db
    .delete(duenos)
    .where(eq(duenos.id, id))
    .returning();

  return result[0];

});