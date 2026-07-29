import type { Config }
from "drizzle-kit";

const databaseUrl = (
  process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
)?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatoria para Drizzle Kit.");
}

export default {

  schema:
    "./drizzle/schema.ts",

  out:
    "./drizzle/migrations",

  dialect:
    "postgresql",

  dbCredentials: {
    url: databaseUrl
  }

} satisfies Config;
