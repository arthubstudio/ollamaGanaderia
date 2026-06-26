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

  const vacas =
    await sql`

      SELECT id
      FROM bovinos

    `;

  for (const vaca of vacas) {

    await rebuildBovinoContext(
      vaca.id
    );

  }

  return {

    ok: true,

    total:
      bovinos.length

  };

});