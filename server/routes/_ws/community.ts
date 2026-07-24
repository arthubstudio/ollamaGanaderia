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
  verifyUserSessionToken
} from "~/server/utils/session";

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

function sendError(peer: { send: (data: unknown) => unknown }, error: any, request: any) {
  const message =
    error?.data?.message ||
    error?.statusMessage ||
    error?.message ||
    "No se pudo procesar el evento del chat.";
  peer.send(JSON.stringify({
    type: "error",
    code: error?.data?.code || error?.code || "CHAT_ERROR",
    message,
    client_message_id: request?.client_message_id ?? null
  }));
}

export default defineWebSocketHandler({
  upgrade(request) {
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
    const userId = verifyUserSessionToken(
      token,
      String(useRuntimeConfig().sessionSecret)
    );
    if (!userId) {
      return new Response("No autenticado", { status: 401 });
    }

    const requestUrl = new URL(request.url);
    request.context.userId = userId;
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
      peer.close(1011, "No se pudo sincronizar el chat");
    }
  },

  async message(peer, rawMessage) {
    const userId = peerUserId(peer);
    if (!userId) {
      peer.close(1008, "No autenticado");
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
  },

  error(peer, error) {
    const userId = peerUserId(peer);
    if (userId) unregisterCommunityPeer(userId, peer.id);
    console.error("Error WebSocket del chat comunitario:", error);
  }
});
