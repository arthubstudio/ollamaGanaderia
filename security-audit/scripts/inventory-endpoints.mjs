import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dirname, "..", "..");
const API_ROOT = path.join(APP_ROOT, "server", "api");
const OUTPUT_DIR = path.join(APP_ROOT, "security-audit", "test-results");
const routePattern = /\.(get|post|put|patch|delete|head|options)\.ts$/i;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function routeFromFile(file) {
  const relative = path.relative(API_ROOT, file).replaceAll("\\", "/");
  const match = relative.match(routePattern);
  if (!match) return null;
  const method = match[1].toUpperCase();
  const withoutSuffix = relative.replace(routePattern, "");
  const segments = withoutSuffix
    .split("/")
    .filter((segment) => segment !== "index")
    .map((segment) => segment.replace(/^\[([^\]]+)\]$/, ":$1"));
  return { method, route: `/api/${segments.join("/")}`, relative };
}

function classify(source, route) {
  const requiresSession = /requireUserId\s*\(/.test(source);
  const roleCheck = /\brol\b|userRole|\badmin\b/.test(source);
  const ownershipCheck = /requireOwned|usuario_id\s*=|usuarioId|userId|sourceUserId|participant|member/i.test(source);
  const input = [
    /readBody\s*</.test(source) || /readBody\s*\(/.test(source) ? "body" : null,
    /getQuery\s*\(/.test(source) ? "query" : null,
    /context\.params/.test(source) ? "path" : null
  ].filter(Boolean);
  const controls = [
    requiresSession ? "session" : "public",
    /enforceRateLimit\s*\(/.test(source) ? "route-rate-limit" : "global-rate-limit",
    ownershipCheck ? "ownership-or-user-scope" : null,
    roleCheck ? "role-aware" : null,
    /detectPromptInjection\s*\(/.test(source) ? "prompt-guardrail" : null,
    /runApi\s*\(/.test(source) ? "normalized-errors" : null,
    /createEventStream|text\/event-stream|setInterval/.test(source) ? "sse" : null
  ].filter(Boolean);

  return {
    authentication: requiresSession ? "required" : "not declared in route",
    authorization: ownershipCheck ? "route/service user scoping detected" : (requiresSession ? "session only or delegated" : "public"),
    role_check: roleCheck,
    input_sources: input,
    controls,
    notes: route === "/api/conversations/by-user/test"
      ? "Unauthenticated diagnostic route returning {ok:true}."
      : null
  };
}

const files = await walk(API_ROOT);
const endpoints = [];
const internalModules = [];

for (const file of files.sort()) {
  const route = routeFromFile(file);
  const source = await readFile(file, "utf8");
  if (!route) {
    if (file.includes(`${path.sep}tools${path.sep}`)) {
      internalModules.push(path.relative(APP_ROOT, file).replaceAll("\\", "/"));
    }
    continue;
  }
  endpoints.push({
    method: route.method,
    route: route.route,
    file: `server/api/${route.relative}`,
    ...classify(source, route.route)
  });
}

for (const relativeFile of internalModules) {
  const route = `/${relativeFile
    .replace(/^server\/api\//, "api/")
    .replace(/\.ts$/, "")}`;
  endpoints.push({
    method: "ANY",
    route,
    file: relativeFile,
    authentication: "no event handler declared in source module",
    authorization: "named tool function expects a userId argument; no HTTP boundary is defined",
    role_check: false,
    input_sources: [],
    controls: ["named-export-only", "runtime-behavior-tested-separately"],
    notes: "Nitro production build nevertheless registers this module as an HTTP route because it lives under server/api."
  });
}

endpoints.push({
  method: "WS",
  route: "/_ws/community",
  file: "server/routes/_ws/community.ts",
  authentication: "required during WebSocket upgrade",
  authorization: "conversation membership checked for subscribe/send/read",
  role_check: false,
  input_sources: ["websocket-event"],
  controls: ["encrypted-session-token", "participant-check", "message-deduplication"],
  notes: "No event-level request-size or rate-limit control detected."
});

const inventory = {
  generated_at: new Date().toISOString(),
  endpoint_count: endpoints.length,
  api_file_count: files.filter((file) => routeFromFile(file)).length,
  internal_tool_module_count: internalModules.length,
  global_controls: [
    "Origin/Referer validation for unsafe HTTP methods",
    "Persistent PostgreSQL-backed global rate limiting",
    "Security headers through server/middleware/security.ts",
    "Encrypted HttpOnly session cookie"
  ],
  endpoints,
  tool_modules_registered_as_routes: internalModules
};

const markdownRows = endpoints.map((endpoint) => {
  const input = endpoint.input_sources.join(", ") || "none";
  const controls = endpoint.controls.join(", ");
  const note = endpoint.notes || "";
  return `| ${endpoint.method} | \`${endpoint.route}\` | ${endpoint.authentication} | ${endpoint.authorization} | ${input} | ${controls} | ${note} |`;
});

const markdown = [
  "# Inventario de endpoints",
  "",
  `Generado: ${inventory.generated_at}`,
  "",
  `Total: ${inventory.endpoint_count} superficies HTTP/WebSocket.`,
  "",
  "| Metodo | Ruta | Autenticacion | Autorizacion | Entrada | Controles | Nota |",
  "|---|---|---|---|---|---|---|",
  ...markdownRows,
  "",
  "## Modulos internos",
  "",
  "Los siguientes archivos fueron pensados como modulos importados. El manifiesto Nitro de produccion los registra tambien como rutas sin metodo, por lo que ya estan incluidos en el conteo:",
  "",
  ...internalModules.map((file) => `- \`${file}\``),
  ""
].join("\n");

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(path.join(OUTPUT_DIR, "endpoint-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
await writeFile(path.join(OUTPUT_DIR, "endpoint-inventory.md"), markdown, "utf8");
process.stdout.write(`${inventory.endpoint_count} endpoint surfaces inventoried.\n`);
