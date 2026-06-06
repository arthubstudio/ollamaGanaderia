import { db } from "~/lib/db";

import { vacas }
from "~/drizzle/schema";

import { eq }
from "drizzle-orm";

export default defineEventHandler(
  async (event) => {

    const id =
      Number(event.context.params?.id);

    const result = await db
      .select()
      .from(vacas)
      .where(eq(vacas.id, id));

    return result[0];

  }
);