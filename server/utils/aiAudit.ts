import { createHash } from "node:crypto";

export function hashAuditText(value: unknown) {
  return createHash("sha256")
    .update(String(value ?? ""), "utf8")
    .digest("hex");
}

export function sanitizeToolExecutions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((tool: any) => ({
    name: String(tool?.name ?? "unknown")
      .replace(/[^a-zA-Z0-9_.:-]/g, "")
      .slice(0, 100),
    status: tool?.status === "SUCCESS" ? "SUCCESS" : "ERROR"
  }));
}

export function sanitizeAuditLabel(value: unknown, maxLength = 300) {
  return String(value ?? "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\b\d{8,}\b/g, "[NUMBER]")
    .slice(0, maxLength);
}
