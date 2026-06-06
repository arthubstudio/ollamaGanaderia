import { db } from "~/lib/db";
import { ranchos } from "~/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);

  const result = await db
    .delete(ranchos)
    .where(eq(ranchos.id, id))
    .returning();

  return result[0];
});