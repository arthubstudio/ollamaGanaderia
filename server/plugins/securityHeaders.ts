import { createHash } from "node:crypto";
import {
  removeResponseHeader,
  setResponseHeader
} from "h3";

function inlineHashes(html: string, tagName: "script" | "style") {
  const hashes = new Set<string>();
  const pattern = new RegExp(
    `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
    "gi"
  );

  for (const match of html.matchAll(pattern)) {
    const attributes = match[1] ?? "";
    const content = match[2] ?? "";
    if (!content || (tagName === "script" && /\\bsrc\\s*=/i.test(attributes))) {
      continue;
    }

    const digest = createHash("sha256")
      .update(content, "utf8")
      .digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }

  return [...hashes];
}

function productionCsp(html: string) {
  const scripts = inlineHashes(html, "script");
  const styles = inlineHashes(html, "style");

  return [
    "default-src 'self'",
    ["script-src 'self'", ...scripts].join(" "),
    ["style-src 'self'", ...styles].join(" "),
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", (event, response) => {
    removeResponseHeader(event, "X-Powered-By");
    removeResponseHeader(event, "Server-Timing");
    event.node.res.removeHeader("X-Powered-By");
    event.node.res.removeHeader("Server-Timing");

    if (
      process.env.NODE_ENV === "production" &&
      typeof response.body === "string" &&
      /<html[\\s>]/i.test(response.body)
    ) {
      setResponseHeader(
        event,
        "Content-Security-Policy",
        productionCsp(response.body)
      );
    }
  });
});
