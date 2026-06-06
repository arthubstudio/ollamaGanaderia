import type { Config }
from "drizzle-kit";

export default {

  schema:
    "./drizzle/schema.ts",

  out:
    "./drizzle/migrations",

  dialect:
    "postgresql",

  dbCredentials: {

    url:
"postgresql://ganaderia:ganaderia123@localhost:5433/ganaderia_ai"

  }

} satisfies Config;