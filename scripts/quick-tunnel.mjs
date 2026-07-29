import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nitroEntry = fileURLToPath(new URL("../.output/server/index.mjs", import.meta.url));
const tunnelServer = fileURLToPath(new URL("./start-tunnel.mjs", import.meta.url));
const quickTunnelPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i;

function extractQuickTunnelUrl(output) {
  return output.match(quickTunnelPattern)?.[0] ?? null;
}

if (process.argv.includes("--check")) {
  const expected = "https://example-random-host.trycloudflare.com";
  const actual = extractQuickTunnelUrl(`INF Your quick Tunnel has been created! ${expected}`);
  if (actual !== expected) {
    throw new Error("No se pudo validar el detector de URL de Cloudflare.");
  }
  console.log("Detector de Quick Tunnel: OK");
  process.exit(0);
}

const port = String(process.env.TUNNEL_PORT ?? "3001").trim();
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error("TUNNEL_PORT debe ser un puerto valido entre 1 y 65535.");
}

const sessionSecret = String(process.env.NUXT_SESSION_SECRET ?? "");
if (sessionSecret.length < 32 || /^(change|replace|example|ganaderia-ai-local)/i.test(sessionSecret)) {
  throw new Error("NUXT_SESSION_SECRET debe tener al menos 32 caracteres aleatorios.");
}
if (!process.env.DATABASE_RUNTIME_URL) {
  throw new Error("Falta DATABASE_RUNTIME_URL. Ejecuta npm run db:runtime:configure.");
}
if (!existsSync(nitroEntry)) {
  throw new Error("No existe el build de Nitro. Ejecuta npm run build antes del tunel.");
}

const cloudflaredCommand = String(process.env.CLOUDFLARED_BIN ?? "cloudflared").trim();
const localOrigin = `http://127.0.0.1:${port}`;
let tunnelProcess;
let appProcess;
let shuttingDown = false;
let exitTimer;
const outputBuffers = new Map();

function stopChild(child) {
  if (child && child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const normalizedExitCode = Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255
    ? exitCode
    : 1;
  process.exitCode = normalizedExitCode;
  clearTimeout(urlTimeout);
  stopChild(appProcess);
  stopChild(tunnelProcess);

  exitTimer = setTimeout(() => process.exit(normalizedExitCode), 1500);
  exitTimer.unref();
}

function startNitro(publicUrl) {
  if (appProcess || shuttingDown) return;
  clearTimeout(urlTimeout);

  const publicHost = new URL(publicUrl).hostname.toLowerCase();
  console.log(`\nURL publica: ${publicUrl}`);
  console.log(`Origen local seguro: ${localOrigin}`);
  console.log("El host temporal se configuro solo para esta ejecucion.\n");

  appProcess = spawn(process.execPath, [tunnelServer], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NUXT_PUBLIC_APP_ORIGIN: publicUrl,
      NUXT_ALLOWED_HOSTS: publicHost,
      NUXT_TRUST_PROXY: "loopback",
      TUNNEL_PORT: port
    },
    stdio: "inherit",
    windowsHide: true
  });

  appProcess.on("error", (error) => {
    console.error(`No se pudo iniciar Nitro: ${error.message}`);
    shutdown(1);
  });

  appProcess.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`Nitro finalizo (${signal ?? code ?? "sin codigo"}).`);
    shutdown(code ?? 1);
  });
}

function consumeCloudflaredOutput(streamName, chunk, destination) {
  destination.write(chunk);
  const previous = outputBuffers.get(streamName) ?? "";
  const combined = `${previous}${chunk.toString("utf8")}`.slice(-8192);
  outputBuffers.set(streamName, combined);

  const publicUrl = extractQuickTunnelUrl(combined);
  if (publicUrl) startNitro(publicUrl);
}

console.log(`Creando Cloudflare Quick Tunnel hacia ${localOrigin}...`);
tunnelProcess = spawn(cloudflaredCommand, ["tunnel", "--url", localOrigin], {
  cwd: projectRoot,
  stdio: ["inherit", "pipe", "pipe"],
  windowsHide: true
});

tunnelProcess.stdout.on("data", (chunk) => {
  consumeCloudflaredOutput("stdout", chunk, process.stdout);
});
tunnelProcess.stderr.on("data", (chunk) => {
  consumeCloudflaredOutput("stderr", chunk, process.stderr);
});

tunnelProcess.on("error", (error) => {
  const detail = error.code === "ENOENT"
    ? "No se encontro cloudflared en PATH. Instala Cloudflare Tunnel y vuelve a intentar."
    : `No se pudo iniciar cloudflared: ${error.message}`;
  console.error(detail);
  shutdown(1);
});

tunnelProcess.on("exit", (code, signal) => {
  if (shuttingDown) return;
  console.error(`Cloudflare Tunnel finalizo (${signal ?? code ?? "sin codigo"}).`);
  shutdown(code ?? 1);
});

const urlTimeout = setTimeout(() => {
  console.error("Cloudflare no devolvio una URL de Quick Tunnel en 60 segundos.");
  shutdown(1);
}, 60_000);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
