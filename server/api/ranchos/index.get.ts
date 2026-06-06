import { db } from "~/lib/db";
import { ranchos } from "~/drizzle/schema";

export default defineEventHandler(async () => {

  return await db.select().from(ranchos);

});