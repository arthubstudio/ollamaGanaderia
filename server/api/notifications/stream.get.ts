import { createEventStream } from "h3";
import { listNotifications } from "~/server/services/notifications";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = requireUserId(event);
  const stream = createEventStream(event);
  let lastPayload = "";

  const publish = async () => {
    const data = await listNotifications(userId, true, 20);
    const payload = JSON.stringify(data);
    if (payload !== lastPayload) {
      lastPayload = payload;
      await stream.push({ event: "notifications", data: payload });
    }
  };

  await publish();
  const interval = setInterval(() => publish().catch(() => null), 2000);
  stream.onClosed(async () => {
    clearInterval(interval);
    await stream.close();
  });
  return stream.send();
});

