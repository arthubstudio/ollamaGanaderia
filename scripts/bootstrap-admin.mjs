import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

const name = String(process.env.ADMIN_NAME ?? "").trim();
const email = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD ?? "");
const databaseUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("Falta DATABASE_MIGRATION_URL o DATABASE_URL.");
if (!name || name.length > 100) throw new Error("Configura ADMIN_NAME (maximo 100 caracteres).");
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 150) {
  throw new Error("Configura un ADMIN_EMAIL valido.");
}
if (password.length < 12 || password.length > 200) {
  throw new Error("ADMIN_PASSWORD debe tener entre 12 y 200 caracteres.");
}

const common = new Set([
  "123456789012",
  "password1234",
  "contrasena123",
  "ganaderia123"
]);
if (common.has(password.toLowerCase().replace(/\s+/g, ""))) {
  throw new Error("ADMIN_PASSWORD es demasiado comun.");
}

const salt = randomBytes(16);
const passwordHash = `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 64).toString("base64url")}`;
const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO usuarios (
        nombre, email, password_hash, rol,
        security_locked_at, password_changed_at
      )
      VALUES (${name}, ${email}, ${passwordHash}, 'admin', NULL, NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        nombre = EXCLUDED.nombre,
        password_hash = EXCLUDED.password_hash,
        rol = 'admin',
        security_locked_at = NULL,
        password_changed_at = NOW()
    `;
    await tx`
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE user_id = (SELECT id FROM usuarios WHERE LOWER(email) = ${email})
        AND revoked_at IS NULL
    `;
  });
} finally {
  await sql.end();
}

console.log(`Administrador ${email} creado o rotado. Todas sus sesiones anteriores fueron revocadas.`);
