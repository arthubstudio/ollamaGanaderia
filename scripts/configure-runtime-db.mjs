import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";

const ENV_PATH = new URL("../.env", import.meta.url);
const ROLE_PATTERN = /^[a-z][a-z0-9_]{2,62}$/;
const rotate = process.argv.includes("--rotate");

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function updateEnv(text, updates) {
  const pending = new Map(Object.entries(updates));
  const lines = text.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  for (const [key, value] of pending) lines.push(`${key}=${value}`);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

const envText = await readFile(ENV_PATH, "utf8");
const fileEnv = parseEnv(envText);
const adminUrl = process.env.DATABASE_MIGRATION_URL ||
  process.env.DATABASE_URL ||
  fileEnv.get("DATABASE_MIGRATION_URL") ||
  fileEnv.get("DATABASE_URL");

if (!adminUrl) throw new Error("Falta DATABASE_URL o DATABASE_MIGRATION_URL.");

const role = String(process.env.APP_DB_USER || fileEnv.get("APP_DB_USER") || "ganaderia_app");
if (!ROLE_PATTERN.test(role)) throw new Error("APP_DB_USER no es un identificador seguro.");

let password = String(process.env.APP_DB_PASSWORD || fileEnv.get("APP_DB_PASSWORD") || "");
if (!password || rotate || password.startsWith("CHANGE_ME")) {
  password = randomBytes(36).toString("base64url");
}

const parsedUrl = new URL(adminUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
if (!databaseName) throw new Error("DATABASE_URL no incluye una base de datos.");

const admin = postgres(adminUrl, { prepare: false, max: 1 });
try {
  const existing = await admin`
    SELECT 1 AS exists
    FROM pg_roles
    WHERE rolname = ${role}
  `;

  if (existing.length === 0) {
    const command = await admin`
      SELECT format(
        'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
        ${role}::text,
        ${password}::text
      ) AS value
    `;
    await admin.unsafe(String(command[0].value));
  } else {
    const command = await admin`
      SELECT format(
        'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
        ${role}::text,
        ${password}::text
      ) AS value
    `;
    await admin.unsafe(String(command[0].value));
  }

  await admin`REVOKE CREATE ON SCHEMA public FROM PUBLIC`;
  await admin`GRANT CONNECT ON DATABASE ${admin(databaseName)} TO ${admin(role)}`;
  await admin`GRANT USAGE ON SCHEMA public TO ${admin(role)}`;
  await admin`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${admin(role)}`;
  await admin`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${admin(role)}`;
  await admin`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${admin(role)}`;
  await admin`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${admin(role)}`;
} finally {
  await admin.end();
}

parsedUrl.username = role;
parsedUrl.password = password;
const runtimeUrl = parsedUrl.toString();
const existingSessionSecret = String(fileEnv.get("NUXT_SESSION_SECRET") || "");
const sessionSecret = existingSessionSecret.length >= 32 &&
  !/^(change|replace|example|ganaderia-ai-local)/i.test(existingSessionSecret)
  ? existingSessionSecret
  : randomBytes(48).toString("base64url");

await writeFile(ENV_PATH, updateEnv(envText, {
  APP_DB_USER: role,
  APP_DB_PASSWORD: password,
  DATABASE_MIGRATION_URL: adminUrl,
  DATABASE_RUNTIME_URL: runtimeUrl,
  NUXT_TRUST_PROXY: fileEnv.get("NUXT_TRUST_PROXY") || "loopback",
  NUXT_SESSION_SECRET: sessionSecret
}), { encoding: "utf8", mode: 0o600 });

console.log(`Rol runtime ${role} configurado sin privilegios de superusuario.`);
console.log("Se actualizo .env sin mostrar la credencial generada.");
