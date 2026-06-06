import { db } from "~/lib/db";
import { ranchos } from "~/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id);

  const result = await db
    .select()
    .from(ranchos)
    .where(eq(ranchos.id, id));

  return result[0];
});