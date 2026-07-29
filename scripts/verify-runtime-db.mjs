import { randomBytes } from "node:crypto";
import postgres from "postgres";

const runtimeUrl = process.env.DATABASE_RUNTIME_URL;
if (!runtimeUrl) throw new Error("Falta DATABASE_RUNTIME_URL.");

const sql = postgres(runtimeUrl, { prepare: false, max: 1 });
const marker = randomBytes(16).toString("hex");
let ddlBlocked = false;
let roleCreationBlocked = false;

async function permissionIsDenied(statement) {
  await sql.unsafe("BEGIN");
  try {
    await sql.unsafe(statement);
    return false;
  } catch (error) {
    return error?.code === "42501";
  } finally {
    await sql.unsafe("ROLLBACK");
  }
}

try {
  const roleRows = await sql`
    SELECT
      current_user AS role,
      r.rolsuper,
      r.rolcreatedb,
      r.rolcreaterole,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_objects,
      has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database_objects
    FROM pg_roles r
    WHERE r.rolname = current_user
  `;
  const role = roleRows[0];
  if (!role || role.rolsuper || role.rolcreatedb || role.rolcreaterole) {
    throw new Error("El rol runtime conserva privilegios administrativos.");
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO security_rate_limits (
        key_hash, request_count, window_started_at, expires_at, updated_at
      ) VALUES (${marker}, 1, NOW(), NOW() + INTERVAL '1 minute', NOW())
    `;
    await tx`DELETE FROM security_rate_limits WHERE key_hash = ${marker}`;
  });

  ddlBlocked = await permissionIsDenied(
    `CREATE TABLE public.runtime_forbidden_${marker} (id integer)`
  );
  roleCreationBlocked = await permissionIsDenied(
    `CREATE ROLE runtime_forbidden_${marker}`
  );

  if (!ddlBlocked || !roleCreationBlocked || role.can_create_schema_objects || role.can_create_database_objects) {
    throw new Error("El rol runtime puede ejecutar una operacion administrativa no autorizada.");
  }

  console.log(`PASS: ${role.role} puede CRUD y no puede DDL, CREATE ROLE ni CREATE DATABASE.`);
} finally {
  await sql.end();
}
