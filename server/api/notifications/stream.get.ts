import { createEventStream } from "h3";
import { listNotifications } from "~/server/services/notifications";
import { requireUserId } from "~/server/utils/session";
import { apiError } from "~/server/utils/api";
import {
  releaseRealtimeConnection,
  tryAcquireRealtimeConnection
} from "~/server/utils/realtimeLimits";

export default defineEventHandler(async (event) => {
  const userId = requireUserId(event);
  const connectionKey = `sse:user:${userId}`;
  if (!tryAcquireRealtimeConnection(connectionKey, 4)) {
    apiError({ statusCode: 429, code: "REALTIME_LIMITED", message: "Hay demasiadas conexiones en tiempo real abiertas." });
  }
  const stream = createEventStream(event);
  let released = false;
  let lastPayload = "";

  const publish = async () => {
    const data = await listNotifications(userId, true, 20);
    const payload = JSON.stringify(data);
    if (payload !== lastPayload) {
      lastPayload = payload;
      await stream.push({ event: "notifications", data: payload });
    }
  };

  const interval = setInterval(() => publish().catch(() => null), 2000);
  const initialPublish = setTimeout(() => publish().catch(() => null), 0);
  stream.onClosed(async () => {
    clearTimeout(initialPublish);
    clearInterval(interval);
    if (!released) {
      released = true;
      releaseRealtimeConnection(connectionKey);
    }
    await stream.close();
  });
  return stream.send();
});
