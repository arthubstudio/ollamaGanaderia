import { db } from "~/lib/db";
import { duenos } from "~/drizzle/schema";

export default defineEventHandler(async () => {

  return await db.select().from(duenos);

});