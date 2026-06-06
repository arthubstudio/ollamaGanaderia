import { db } from "~/lib/db";

import {
  pesos
} from "~/drizzle/schema";

export default defineEventHandler(async () => {

  return await db.select().from(pesos);

});