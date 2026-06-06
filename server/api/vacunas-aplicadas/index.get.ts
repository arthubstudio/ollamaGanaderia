import { db } from "~/lib/db";

import {
  vacunaAplicada
} from "~/drizzle/schema";

export default defineEventHandler(async () => {

  return await db.select().from(vacunaAplicada);

});