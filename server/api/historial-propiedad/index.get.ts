import { db } from "~/lib/db";

import { historialPropiedad }
from "~/drizzle/schema";

export default defineEventHandler(
  async () => {

    return await db
      .select()
      .from(historialPropiedad);

  }
);