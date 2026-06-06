import { db } from "~/lib/db";

import { enfermedades }
from "~/drizzle/schema";

export default defineEventHandler(
  async () => {

    return await db
      .select()
      .from(enfermedades);

  }
);