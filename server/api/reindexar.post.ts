import postgres from "postgres";

import { rebuildVacaContext }
from "~/lib/rebuildVacaContext";

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
      FROM vacas

    `;

  for (const vaca of vacas) {

    await rebuildVacaContext(
      vaca.id
    );

  }

  return {

    ok: true,

    total:
      vacas.length

  };

});