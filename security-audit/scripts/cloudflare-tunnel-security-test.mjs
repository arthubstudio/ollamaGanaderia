import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import WebSocket from "ws";

const AUTHORIZED_HOST = "reviewing-outcome-barn-andrews.trycloudflare.com";
const ORIGIN = `https://${AUTHORIZED_HOST}`;
const HTTP_ORIGIN = `http://${AUTHORIZED_HOST}`;
const APP_ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUTPUT = path.join(
  APP_ROOT,
  "security-audit",
  "test-results",
  "cloudflare-tunnel-security-test.json"
);

const testEmail = String(process.env.TUNNEL_TEST_EMAIL || "").trim();
const testPassword = String(process.env.TUNNEL_TEST_PASSWORD || "");

if (!testEmail || !testPassword) {
  throw new Error("TUNNEL_TEST_EMAIL and TUNNEL_TEST_PASSWORD are required.");
}

function assertAuthorizedUrl(input) {
  const url = new URL(input, ORIGIN);
  if (url.hostname !== AUTHORIZED_HOST) {
    throw new Error(`Out-of-scope hostname rejected: ${url.hostname}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "wss:") {
    throw new Error(`Out-of-scope protocol rejected: ${url.protocol}`);
  }
  return url;
}

async function request(route, options = {}) {
  const url = assertAuthorizedUrl(route);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...options
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Some checks intentionally target HTML and static files.
  }
  return {
    status: response.status,
    headers: response.headers,
    text,
    json
  };
}

function rawMethodRequest(route, method) {
  const url = assertAuthorizedUrl(route);
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method,
      headers: { Origin: ORIGIN },
      timeout: 15_000
    }, (response) => {
      response.resume();
      response.once("end", () => resolve({
        status: response.statusCode || 0,
        allow: response.headers.allow || null
      }));
    });
    request.once("timeout", () => request.destroy(new Error(`${method} request timed out.`)));
    request.once("error", reject);
    request.end();
  });
}

function headerSnapshot(headers) {
  const names = [
    "cache-control",
    "cf-cache-status",
    "cf-ray",
    "content-security-policy",
    "content-type",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "permissions-policy",
    "referrer-policy",
    "server",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "x-powered-by"
  ];
  return Object.fromEntries(names.map((name) => [name, headers.get(name)]));
}

function addTest(report, id, title, pass, evidence) {
  report.tests.push({
    id,
    title,
    status: pass ? "PASS" : "FAIL",
    evidence
  });
}

function cookieDetails(setCookie) {
  const text = String(setCookie || "");
  const pair = text.split(";", 1)[0] || "";
  const separator = pair.indexOf("=");
  return {
    pair,
    attributes: {
      httpOnly: /(?:^|;)\s*httponly(?:;|$)/i.test(text),
      secure: /(?:^|;)\s*secure(?:;|$)/i.test(text),
      sameSiteStrict: /(?:^|;)\s*samesite=strict(?:;|$)/i.test(text),
      pathRoot: /(?:^|;)\s*path=\/(?:;|$)/i.test(text),
      hasMaxAge: /(?:^|;)\s*max-age=\d+(?:;|$)/i.test(text)
    },
    cookieName: separator > 0 ? pair.slice(0, separator) : ""
  };
}

function tamperCookie(pair) {
  const separator = pair.indexOf("=");
  if (separator < 0) return "invalid=invalid";
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  if (!value) return `${name}=invalid`;
  const replacement = value.endsWith("A") ? "B" : "A";
  return `${name}=${value.slice(0, -1)}${replacement}`;
}

function inspectTls() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: AUTHORIZED_HOST,
      port: 443,
      servername: AUTHORIZED_HOST,
      rejectUnauthorized: true
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("TLS check timed out."));
    }, 15_000);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      const result = {
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        validFrom: certificate.valid_from,
        validTo: certificate.valid_to,
        subjectAltNameIncludesHost: String(certificate.subjectaltname || "")
          .toLowerCase()
          .includes("trycloudflare.com")
      };
      socket.end();
      resolve(result);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function checkWebSocket(cookie) {
  return new Promise((resolve) => {
    const wsUrl = assertAuthorizedUrl(`wss://${AUTHORIZED_HOST}/_ws/community?after=0`);
    const socket = new WebSocket(wsUrl, {
      headers: {
        Cookie: cookie,
        Origin: ORIGIN
      },
      handshakeTimeout: 15_000
    });
    let opened = false;
    const finish = (result) => {
      clearTimeout(timer);
      socket.removeAllListeners();
      if (socket.readyState === WebSocket.OPEN) socket.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ opened, readyEvent: false, timeout: true }), 20_000);
    socket.once("open", () => {
      opened = true;
    });
    socket.on("message", (raw) => {
      try {
        const event = JSON.parse(String(raw));
        if (event?.type === "ready") {
          finish({ opened: true, readyEvent: true, timeout: false });
        }
      } catch {
        // Ignore non-JSON frames; they cannot satisfy the authenticated ready check.
      }
    });
    socket.once("unexpected-response", (_request, response) => {
      finish({ opened, readyEvent: false, status: response.statusCode });
    });
    socket.once("error", (error) => {
      finish({ opened, readyEvent: false, error: error.message });
    });
  });
}

const report = {
  title: "Authorized Cloudflare Tunnel security validation",
  generatedAt: new Date().toISOString(),
  scope: {
    authorizedHost: AUTHORIZED_HOST,
    requestsLimitedToAuthorizedHost: true,
    destructiveActions: false,
    businessRecordsCreatedOrDeleted: false,
    possibleStateTransitions: [
      "authentication rate-limit counters",
      "WebSocket delivery timestamps for pending messages"
    ]
  },
  tests: []
};

try {
  const tlsResult = await inspectTls();
  addTest(
    report,
    "CFT-001",
    "TLS certificate and protocol validation",
    tlsResult.authorized && /^TLSv1\.[23]$/.test(String(tlsResult.protocol)),
    tlsResult
  );

  const loginPage = await request(`${ORIGIN}/login`);
  const loginHeaders = headerSnapshot(loginPage.headers);
  addTest(
    report,
    "CFT-002",
    "Tunnel serves the login page without a blocked-host response",
    loginPage.status === 200 && !/host.+not allowed|blocked request/i.test(loginPage.text),
    {
      status: loginPage.status,
      contentType: loginHeaders["content-type"],
      cloudflareRayPresent: Boolean(loginHeaders["cf-ray"]),
      cloudflareCacheStatus: loginHeaders["cf-cache-status"]
    }
  );

  const csp = String(loginHeaders["content-security-policy"] || "");
  const hardenedHeaders =
    loginHeaders["strict-transport-security"]?.includes("max-age=") &&
    loginHeaders["x-frame-options"] === "DENY" &&
    loginHeaders["x-content-type-options"] === "nosniff" &&
    csp.includes("frame-ancestors 'none'") &&
    !loginHeaders["x-powered-by"];
  addTest(report, "CFT-003", "HTTPS security headers", Boolean(hardenedHeaders), loginHeaders);

  const productionCsp =
    !csp.includes("'unsafe-eval'") &&
    !csp.includes("'unsafe-inline'") &&
    !/connect-src[^;]*(?:\bws:|\bwss:)/i.test(csp);
  addTest(report, "CFT-004", "Production-strength CSP on the public tunnel", productionCsp, {
    unsafeEval: csp.includes("'unsafe-eval'"),
    unsafeInline: csp.includes("'unsafe-inline'"),
    unrestrictedWebSocketSchemes: /connect-src[^;]*(?:\bws:|\bwss:)/i.test(csp)
  });

  const httpResponse = await request(`${HTTP_ORIGIN}/login`);
  const location = httpResponse.headers.get("location") || "";
  addTest(
    report,
    "CFT-005",
    "Plain HTTP redirects to the same HTTPS host",
    [301, 302, 307, 308].includes(httpResponse.status) && location.startsWith(`${ORIGIN}/`),
    { status: httpResponse.status, location }
  );

  const protectedRoutes = [
    "/api/auth/me",
    "/api/bovinos",
    "/api/observabilidad",
    "/api/conversations/by-user/security-audit"
  ];
  const protectedResults = [];
  for (const route of protectedRoutes) {
    const response = await request(`${ORIGIN}${route}`, {
      headers: { Origin: ORIGIN }
    });
    protectedResults.push({
      route,
      status: response.status,
      code: response.json?.code || null
    });
  }
  addTest(
    report,
    "CFT-006",
    "Protected APIs reject anonymous requests",
    protectedResults.every((item) => item.status === 401),
    protectedResults
  );

  const sensitiveTargets = [
    { route: "/.env", markers: [/POSTGRES_PASSWORD\s*=/i, /NUXT_SESSION_SECRET\s*=/i] },
    { route: "/.git/config", markers: [/repositoryformatversion/i, /\[core\]/i] },
    { route: "/AI_CONTEXT.md", markers: [/#\s*AI_CONTEXT/i, /Resumen del proyecto/i] },
    { route: "/package.json", markers: [/"dependencies"\s*:/i, /"nuxt"\s*:/i] },
    { route: "/nuxt.config.ts", markers: [/defineNuxtConfig/i] },
    { route: "/database/seeds.sql", markers: [/INSERT\s+INTO\s+usuarios/i] },
    { route: "/server/utils/session.ts", markers: [/SESSION_COOKIE_NAME/i, /createCipheriv/i] },
    { route: "/security-audit/SECURITY_AUDIT_GANADERIA.md", markers: [/PUNTUACI[OÓ]N FINAL/i] }
  ];
  const sensitiveResults = [];
  for (const target of sensitiveTargets) {
    const response = await request(`${ORIGIN}${target.route}`);
    const exposed = target.markers.every((marker) => marker.test(response.text));
    sensitiveResults.push({
      route: target.route,
      status: response.status,
      contentType: response.headers.get("content-type"),
      responseBytes: Buffer.byteLength(response.text),
      exposed
    });
  }
  addTest(
    report,
    "CFT-007",
    "Sensitive project files are not exposed",
    sensitiveResults.every((item) => !item.exposed),
    sensitiveResults
  );

  const devTargets = ["/@vite/client", "/_nuxt/@vite/client", "/__nuxt_vite_node__"];
  const devResults = [];
  for (const route of devTargets) {
    const response = await request(`${ORIGIN}${route}`);
    const runtimeCode =
      /vite\/client|hot\.on|createHotContext|__vite__/i.test(response.text) &&
      /javascript|typescript/i.test(response.headers.get("content-type") || "");
    devResults.push({
      route,
      status: response.status,
      contentType: response.headers.get("content-type"),
      runtimeCode
    });
  }
  addTest(
    report,
    "CFT-008",
    "Development runtime is not publicly exposed",
    devResults.every((item) => !item.runtimeCode),
    devResults
  );

  const traceResponse = await rawMethodRequest(`${ORIGIN}/login`, "TRACE");
  addTest(
    report,
    "CFT-009",
    "TRACE is disabled",
    [403, 405, 501].includes(traceResponse.status),
    { status: traceResponse.status, allow: traceResponse.allow }
  );

  const crossSite = await request(`${ORIGIN}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
      "Sec-Fetch-Site": "cross-site"
    },
    body: "{}"
  });
  addTest(
    report,
    "CFT-010",
    "Cross-site unsafe request is rejected",
    crossSite.status === 403,
    { status: crossSite.status, code: crossSite.json?.code || null }
  );

  const forgedProxy = await request(`${ORIGIN}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
      "X-Forwarded-Host": "attacker.invalid",
      "X-Forwarded-Proto": "https"
    },
    body: "{}"
  });
  addTest(
    report,
    "CFT-011",
    "Cloudflare does not permit forwarded-host origin bypass",
    forgedProxy.status === 403,
    { status: forgedProxy.status, code: forgedProxy.json?.code || null }
  );

  const invalidLogin = await request(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify({
      email: `security-audit-${Date.now()}@example.invalid`,
      password: "invalid-security-audit-password"
    })
  });
  addTest(
    report,
    "CFT-012",
    "Invalid login has a generic response and no session cookie",
    invalidLogin.status === 401 &&
      invalidLogin.json?.code === "INVALID_CREDENTIALS" &&
      !invalidLogin.headers.get("set-cookie"),
    {
      status: invalidLogin.status,
      code: invalidLogin.json?.code || null,
      setCookiePresent: Boolean(invalidLogin.headers.get("set-cookie"))
    }
  );

  const validLogin = await request(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  const setCookie = validLogin.headers.get("set-cookie");
  const cookie = cookieDetails(setCookie);
  const allCookieFlags = Object.values(cookie.attributes).every(Boolean);
  addTest(
    report,
    "CFT-013",
    "Authenticated session cookie is hardened over the tunnel",
    validLogin.status === 200 &&
      cookie.cookieName === "ganaderia_session" &&
      allCookieFlags,
    {
      status: validLogin.status,
      cookieName: cookie.cookieName,
      attributes: cookie.attributes,
      tokenRecorded: false
    }
  );

  if (!cookie.pair || validLogin.status !== 200) {
    throw new Error(`Authenticated tunnel check could not continue (status ${validLogin.status}).`);
  }

  const authenticatedMe = await request(`${ORIGIN}/api/auth/me`, {
    headers: { Cookie: cookie.pair, Origin: ORIGIN }
  });
  addTest(
    report,
    "CFT-014",
    "Authenticated API works through Cloudflare",
    authenticatedMe.status === 200 && Number.isInteger(Number(authenticatedMe.json?.id)),
    { status: authenticatedMe.status, returnedAuthenticatedUser: Boolean(authenticatedMe.json?.id) }
  );

  const tamperedMe = await request(`${ORIGIN}/api/auth/me`, {
    headers: { Cookie: tamperCookie(cookie.pair), Origin: ORIGIN }
  });
  addTest(
    report,
    "CFT-015",
    "Tampered session cookie is rejected",
    tamperedMe.status === 401,
    { status: tamperedMe.status, code: tamperedMe.json?.code || null }
  );

  const websocketResult = await checkWebSocket(cookie.pair);
  addTest(
    report,
    "CFT-016",
    "Authenticated WebSocket handshake works through Cloudflare",
    websocketResult.opened && websocketResult.readyEvent,
    websocketResult
  );

  const corsResponse = await request(`${ORIGIN}/api/auth/me`, {
    headers: { Origin: "https://attacker.invalid" }
  });
  addTest(
    report,
    "CFT-017",
    "Anonymous API response does not grant cross-origin access",
    !corsResponse.headers.get("access-control-allow-origin"),
    {
      status: corsResponse.status,
      accessControlAllowOrigin: corsResponse.headers.get("access-control-allow-origin")
    }
  );

  const logout = await request(`${ORIGIN}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie.pair,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin"
    },
    body: "{}"
  });
  const capturedAfterLogout = await request(`${ORIGIN}/api/auth/me`, {
    headers: { Cookie: cookie.pair, Origin: ORIGIN }
  });
  addTest(
    report,
    "CFT-018",
    "Server revokes a captured token after logout",
    logout.status === 200 && capturedAfterLogout.status === 401,
    {
      logoutStatus: logout.status,
      capturedTokenStatusAfterLogout: capturedAfterLogout.status,
      tokenRecorded: false
    }
  );
} catch (error) {
  report.runnerError = {
    name: error?.name || "Error",
    message: error?.message || String(error)
  };
} finally {
  const passed = report.tests.filter((test) => test.status === "PASS").length;
  const failed = report.tests.filter((test) => test.status === "FAIL").length;
  report.summary = {
    executed: report.tests.length,
    passed,
    failed,
    runnerErrors: report.runnerError ? 1 : 0
  };
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report.summary)}\n`);
}
