import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const runtimeUrl = process.env.DATABASE_RUNTIME_URL?.trim();
const migrationUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = runtimeUrl || migrationUrl;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_RUNTIME_URL es obligatoria. Ejecuta npm run db:runtime:configure antes de iniciar la aplicacion."
  );
}

if (process.env.NODE_ENV === "production" && !runtimeUrl) {
  throw new Error(
    "DATABASE_RUNTIME_URL es obligatoria en produccion para evitar usar el propietario de migraciones."
  );
}

if (!runtimeUrl) {
  console.warn("DATABASE_RUNTIME_URL no esta configurada; se usa DATABASE_URL solo para desarrollo local.");
}

export const sql = postgres(databaseUrl, {
  prepare: false,
});

export const db = drizzle(sql);
