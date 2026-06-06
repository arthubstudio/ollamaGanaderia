import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const client = postgres("postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai", {
  prepare: false,
});

export const db = drizzle(client);