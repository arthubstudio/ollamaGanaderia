import postgres from "postgres";

import { rebuildBovinoContext }
from "~/lib/rebuildBovinoContext";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async () => {

  const bovinos =
    await sql`

      SELECT id
      FROM bovinos

    `;

  for (const bovino of bovinos) {

    await rebuildBovinoContext(
      bovino.id
    );

  }

  return {

    ok: true,

    total:
      bovinos.length

  };

});
