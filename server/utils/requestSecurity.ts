import { isIP } from "node:net";
import {
  getMethod,
  getRequestHeader,
  getRequestIP,
  getRequestProtocol,
  type H3Event
} from "h3";
import { apiError } from "~/server/utils/api";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function splitCsv(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseHostHeader(value: string | null | undefined) {
  const input = String(value ?? "").trim();
  if (!input || /[\\/\s]/.test(input)) return null;

  try {
    const parsed = new URL(`http://${input}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!hostname || (!isIP(hostname) && !/^[a-z0-9.-]+$/.test(hostname))) {
      return null;
    }
    return {
      authority: parsed.host.toLowerCase(),
      hostname
    };
  } catch {
    return null;
  }
}

export function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function getCanonicalRequestHost(event: H3Event) {
  return parseHostHeader(getRequestHeader(event, "host"));
}

export function isTrustedProxyConnection(event: H3Event) {
  const trustMode = String(process.env.NUXT_TRUST_PROXY ?? "")
    .trim()
    .toLowerCase();
  if (trustMode !== "loopback") return false;

  const directAddress = String(
    getRequestIP(event, { xForwardedFor: false }) ?? ""
  ).replace(/^::ffff:/, "");
  return directAddress === "127.0.0.1" || directAddress === "::1";
}

export function getTrustedForwardedProtocol(event: H3Event) {
  if (!isTrustedProxyConnection(event)) return null;
  const protocol = String(getRequestHeader(event, "x-forwarded-proto") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return protocol === "https" || protocol === "http" ? protocol : null;
}

export function isSecureRequest(event: H3Event) {
  return getRequestProtocol(event) === "https" ||
    getTrustedForwardedProtocol(event) === "https";
}

export function getConfiguredPublicOrigin() {
  const value = String(process.env.NUXT_PUBLIC_APP_ORIGIN ?? "").trim();
  if (!value) return null;
  try {
    const origin = new URL(value);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") return null;
    return origin.origin;
  } catch {
    return null;
  }
}

export function getCanonicalRequestOrigin(event: H3Event) {
  const host = getCanonicalRequestHost(event);
  if (!host) return null;

  const configuredOrigin = getConfiguredPublicOrigin();
  if (configuredOrigin) {
    const configured = new URL(configuredOrigin);
    if (configured.hostname.toLowerCase() === host.hostname) {
      return configured.origin;
    }
  }

  const protocol = isSecureRequest(event) ? "https" : "http";
  return `${protocol}://${host.authority}`;
}

export function assertAllowedRequestHost(event: H3Event) {
  const host = getCanonicalRequestHost(event);
  if (!host) {
    apiError({
      statusCode: 400,
      code: "INVALID_HOST",
      message: "El host de la solicitud no es valido."
    });
  }

  if (isLoopbackHostname(host.hostname)) return;

  const configuredHosts = new Set(splitCsv(process.env.NUXT_ALLOWED_HOSTS));
  const publicOrigin = getConfiguredPublicOrigin();
  if (publicOrigin) configuredHosts.add(new URL(publicOrigin).hostname.toLowerCase());

  if (process.env.NODE_ENV !== "production" || !configuredHosts.has(host.hostname)) {
    apiError({
      statusCode: 421,
      code: "HOST_NOT_ALLOWED",
      message: "Este host no esta autorizado para servir la aplicacion."
    });
  }
}

export function isCrossSiteRequest(input: {
  method: string;
  origin?: string | null;
  referer?: string | null;
  targetOrigin: string;
  secFetchSite?: string | null;
}) {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;

  const fetchSite = String(input.secFetchSite ?? "").toLowerCase();
  if (fetchSite === "cross-site") return true;

  const sourceUrl = input.origin || input.referer;
  if (!sourceUrl) return true;

  try {
    const source = new URL(sourceUrl);
    const target = new URL(input.targetOrigin);
    if (!/^https?:$/.test(source.protocol)) return true;
    return source.origin !== target.origin;
  } catch {
    return true;
  }
}

export function assertTrustedRequestOrigin(event: H3Event) {
  const method = getMethod(event);
  if (SAFE_METHODS.has(method.toUpperCase())) return;

  const targetOrigin = getCanonicalRequestOrigin(event);
  if (!targetOrigin || isCrossSiteRequest({
    method,
    origin: getRequestHeader(event, "origin"),
    referer: getRequestHeader(event, "referer"),
    targetOrigin,
    secFetchSite: getRequestHeader(event, "sec-fetch-site")
  })) {
    apiError({
      statusCode: 403,
      code: "CROSS_SITE_REQUEST_BLOCKED",
      message: "La solicitud fue bloqueada porque proviene de otro sitio."
    });
  }
}
