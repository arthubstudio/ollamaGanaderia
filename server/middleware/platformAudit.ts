import { getRequestPath } from "h3";
import { recordActivity } from "~/server/services/activityAudit";
import { getSessionUserId } from "~/server/utils/session";

const PLATFORM_PREFIXES = [
  "/api/transfers",
  "/api/breeds",
  "/api/users/search",
  "/api/notifications",
  "/api/community"
];

export default defineEventHandler((event) => {
  const path = getRequestPath(event).split("?")[0];
  if (!PLATFORM_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

  const startedAt = Date.now();
  const userId = getSessionUserId(event);
  const method = String(event.method ?? "GET").toUpperCase();

  event.node.res.once("finish", () => {
    const statusCode = event.node.res.statusCode;
    recordActivity({
      actorUserId: userId,
      action: `http.${method.toLowerCase()}`,
      entityType: "platform_endpoint",
      entityId: path,
      success: statusCode < 400,
      durationMs: Date.now() - startedAt,
      metadata: { path, method, status_code: statusCode }
    }).catch((error) => console.error("No se pudo registrar auditoria HTTP", error));
  });
});

