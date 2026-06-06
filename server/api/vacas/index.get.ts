import { db } from "~/lib/db";
import { vacas } from "~/drizzle/schema";

export default defineEventHandler(async () => {

  return await db.select().from(vacas);

});