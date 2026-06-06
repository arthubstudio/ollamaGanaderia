import { db } from "~/lib/db";
import { vacunas } from "~/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);

  const result = await db
    .delete(vacunas)
    .where(eq(vacunas.id, id))
    .returning();

  return result[0];
});