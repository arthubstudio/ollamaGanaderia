process.env.NODE_ENV = "production";
process.env.HOST = process.env.HOST || "127.0.0.1";

const sessionSecret = String(process.env.NUXT_SESSION_SECRET ?? "");
if (sessionSecret.length < 32 || /^(change|replace|example|ganaderia-ai-local)/i.test(sessionSecret)) {
  throw new Error("NUXT_SESSION_SECRET debe tener al menos 32 caracteres aleatorios.");
}
if (!process.env.DATABASE_RUNTIME_URL) {
  throw new Error("Falta DATABASE_RUNTIME_URL. Ejecuta npm run db:runtime:configure.");
}

await import("../.output/server/index.mjs");
