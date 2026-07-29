import { randomBytes, timingSafeEqual } from "node:crypto";
import { getRequestHeader, type H3Event } from "h3";

const TOKEN_KEY = Symbol.for("ganaderia-ai.internal-request-token");
const globalState = globalThis as Record<PropertyKey, unknown>;
const internalToken = String(
  globalState[TOKEN_KEY] ?? randomBytes(32).toString("base64url")
);
globalState[TOKEN_KEY] = internalToken;

export function internalRequestHeaders() {
  return { "x-ganaderia-internal": internalToken };
}

export function isInternalRequest(event: H3Event) {
  const supplied = String(getRequestHeader(event, "x-ganaderia-internal") ?? "");
  const actual = Buffer.from(internalToken);
  const candidate = Buffer.from(supplied);
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}
