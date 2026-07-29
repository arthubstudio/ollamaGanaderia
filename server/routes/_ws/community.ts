import { defineWebSocketHandler } from "h3";
import {
  markCommunityConversationRead,
  sendCommunityMessage
} from "~/server/services/community";
import {
  publishCommunityReadResult,
  publishPersistedCommunityMessage,
  registerCommunityPeer,
  synchronizeCommunityPeer,
  unregisterCommunityPeer
} from "~/server/services/communityRealtime";
import {
  SESSION_COOKIE_NAME,
  validateActiveUserSessionToken,
  verifyUserSessionToken
} from "~/server/utils/session";
import {
  releaseRealtimeConnection,
  tryAcquireRealtimeConnection
} from "~/server/utils/realtimeLimits";
import { consumeRateLimit, rateLimitKeyPart } from "~/server/utils/rateLimit";

const MAX_FRAME_BYTES = 16 * 1024;
const MAX_CONNECTIONS_PER_USER = 4;

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function peerUserId(peer: { context: Record<string, unknown> }) {
  const userId = Number(peer.context.userId);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function releasePeerConnection(peer: { context: Record<string, unknown> }) {
  if (peer.context.connectionReleased) return;
  peer.context.connectionReleased = true;
  const key = String(peer.context.connectionKey ?? "");
  if (key) releaseRealtimeConnection(key);
}

function sendError(peer: { send: (data: unknown) => unknown }, error: any, request: any) {
  const code = String(error?.data?.code || error?.code || "CHAT_ERROR");
  const message = error?.data?.message ||
    (code === "RATE_LIMITED" ? "Se alcanzo el limite temporal del chat." : null) ||
    "No se pudo procesar el evento del chat.";
  peer.send(JSON.stringify({
    type: "error",
    code,
    message,
    client_message_id: request?.client_message_id ?? null
  }));
}

export default defineWebSocketHandler({
  async upgrade(request) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return new Response("Origen no permitido", { status: 403 });
        }
      } catch {
        return new Response("Origen no permitido", { status: 403 });
      }
    }

    const token = getCookieValue(
      request.headers.get("cookie"),
      SESSION_COOKIE_NAME
    );
    const secret = String(useRuntimeConfig().sessionSecret);
    const decodedUserId = verifyUserSessionToken(token, secret);
    const userId = decodedUserId
      ? await validateActiveUserSessionToken(token, secret)
      : null;
    if (!userId) {
      return new Response("No autenticado", { status: 401 });
    }

    const connectionKey = `ws:community:user:${userId}`;
    if (!tryAcquireRealtimeConnection(connectionKey, MAX_CONNECTIONS_PER_USER)) {
      return new Response("Demasiadas conexiones de chat", { status: 429 });
    }

    const requestUrl = new URL(request.url);
    request.context.userId = userId;
    request.context.sessionToken = token;
    request.context.connectionKey = connectionKey;
    request.context.after = Math.max(
      Number(requestUrl.searchParams.get("after")) || 0,
      0
    );
  },

  async open(peer) {
    const userId = peerUserId(peer);
    if (!userId) {
      peer.close(1008, "No autenticado");
      return;
    }

    registerCommunityPeer(userId, peer);
    try {
      await synchronizeCommunityPeer(userId, peer.context.after, peer);
      peer.send(JSON.stringify({ type: "ready" }));
    } catch (error) {
      sendError(peer, error, null);
      unregisterCommunityPeer(userId, peer.id);
      releasePeerConnection(peer);
      peer.close(1011, "No se pudo sincronizar el chat");
    }
  },

  async message(peer, rawMessage) {
    const userId = peerUserId(peer);
    if (!userId) {
      peer.close(1008, "No autenticado");
      return;
    }

    if (rawMessage.uint8Array().byteLength > MAX_FRAME_BYTES) {
      peer.close(1009, "Mensaje demasiado grande");
      return;
    }

    const quota = consumeRateLimit({
      key: `ws:event:user:${rateLimitKeyPart(userId)}`,
      limit: 120,
      windowMs: 60 * 1000
    });
    if (!quota.allowed) {
      sendError(peer, { code: "RATE_LIMITED" }, null);
      peer.close(1008, "Limite temporal alcanzado");
      return;
    }

    const secret = String(useRuntimeConfig().sessionSecret);
    const activeUserId = await validateActiveUserSessionToken(
      String(peer.context.sessionToken ?? ""),
      secret
    );
    if (activeUserId !== userId) {
      peer.close(1008, "Sesion revocada");
      return;
    }

    let request: any = null;
    try {
      request = rawMessage.json<any>();
      if (!request || typeof request !== "object") {
        throw new Error("Evento de chat no valido.");
      }

      if (request.type === "send") {
        const persisted = await sendCommunityMessage({
          userId,
          conversationId: request.conversation_id,
          content: request.content,
          clientMessageId: request.client_message_id
        });
        await publishPersistedCommunityMessage(persisted);
        return;
      }

      if (request.type === "read") {
        const result = await markCommunityConversationRead(
          userId,
          request.conversation_id,
          request.message_id
        );
        await publishCommunityReadResult(userId, result);
        return;
      }

      if (request.type === "sync") {
        await synchronizeCommunityPeer(userId, request.after, peer);
        return;
      }

      if (request.type === "ping") {
        peer.send(JSON.stringify({ type: "pong", at: Date.now() }));
        return;
      }

      throw new Error("Tipo de evento de chat no soportado.");
    } catch (error) {
      sendError(peer, error, request);
    }
  },

  close(peer) {
    const userId = peerUserId(peer);
    if (userId) unregisterCommunityPeer(userId, peer.id);
    releasePeerConnection(peer);
  },

  error(peer, error) {
    const userId = peerUserId(peer);
    if (userId) unregisterCommunityPeer(userId, peer.id);
    releasePeerConnection(peer);
    console.error("Error WebSocket del chat comunitario:", String(error?.name ?? "WSError"));
  }
});
