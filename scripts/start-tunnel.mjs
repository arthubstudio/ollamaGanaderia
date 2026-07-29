const port = String(process.env.TUNNEL_PORT ?? "3001").trim();

if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error("TUNNEL_PORT debe ser un puerto valido entre 1 y 65535.");
}

process.env.NODE_ENV = "production";
process.env.PORT = port;
process.env.HOST = "127.0.0.1";

const sessionSecret = String(process.env.NUXT_SESSION_SECRET ?? "");
if (sessionSecret.length < 32 || /^(change|replace|example|ganaderia-ai-local)/i.test(sessionSecret)) {
  throw new Error("NUXT_SESSION_SECRET debe tener al menos 32 caracteres aleatorios.");
}
if (!process.env.DATABASE_RUNTIME_URL) {
  throw new Error("Falta DATABASE_RUNTIME_URL. Ejecuta npm run db:runtime:configure.");
}

const publicOrigin = String(process.env.NUXT_PUBLIC_APP_ORIGIN ?? "").trim();
if (!publicOrigin.startsWith("https://")) {
  throw new Error("NUXT_PUBLIC_APP_ORIGIN debe contener la URL HTTPS exacta del tunel.");
}
const publicHost = new URL(publicOrigin).hostname.toLowerCase();
const allowedHosts = String(process.env.NUXT_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase());
if (!allowedHosts.includes(publicHost)) {
  throw new Error("Agrega el hostname exacto del tunel a NUXT_ALLOWED_HOSTS.");
}

console.log(`Servidor seguro para tunel: http://localhost:${port}`);
await import("../.output/server/index.mjs");
