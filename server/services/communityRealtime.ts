import {
  getCommunityMessageForUser,
  listCommunityConversationParticipantIds,
  listCommunityConversations,
  listCommunityUpdates,
  markAllCommunityMessagesDelivered,
  markCommunityMessagesDelivered
} from "~/server/services/community";

type CommunitySocketPeer = {
  id: string;
  send: (data: unknown) => unknown;
};

type CommunityRealtimeState = {
  peersByUser: Map<number, Map<string, CommunitySocketPeer>>;
};

const globalState = globalThis as typeof globalThis & {
  __ganaderiaCommunityRealtime?: CommunityRealtimeState;
};

const state = globalState.__ganaderiaCommunityRealtime ??= {
  peersByUser: new Map()
};

function serialize(payload: unknown) {
  return JSON.stringify(payload);
}

function safeSend(peer: CommunitySocketPeer, payload: unknown) {
  try {
    peer.send(serialize(payload));
    return true;
  } catch {
    return false;
  }
}

function sendToUser(userId: number, payload: unknown) {
  const peers = state.peersByUser.get(userId);
  if (!peers) return 0;

  let sent = 0;
  for (const peer of peers.values()) {
    if (safeSend(peer, payload)) sent += 1;
  }
  return sent;
}

function isUserConnected(userId: number) {
  return (state.peersByUser.get(userId)?.size ?? 0) > 0;
}

export function registerCommunityPeer(userId: number, peer: CommunitySocketPeer) {
  const peers = state.peersByUser.get(userId) ?? new Map<string, CommunitySocketPeer>();
  peers.set(peer.id, peer);
  state.peersByUser.set(userId, peers);
}

export function unregisterCommunityPeer(userId: number, peerId: string) {
  const peers = state.peersByUser.get(userId);
  if (!peers) return;
  peers.delete(peerId);
  if (!peers.size) state.peersByUser.delete(userId);
}

async function publishStatusRows(rows: any[]) {
  const bySender = new Map<number, any[]>();
  for (const row of rows) {
    const senderUserId = Number(row.sender_user_id);
    const items = bySender.get(senderUserId) ?? [];
    items.push({
      id: Number(row.id),
      conversation_id: String(row.conversation_id),
      delivered_at: row.delivered_at ?? null,
      read_at: row.read_at ?? null
    });
    bySender.set(senderUserId, items);
  }

  for (const [senderUserId, updates] of bySender) {
    sendToUser(senderUserId, { type: "status", updates });
  }
}

async function publishConversationSnapshots(participantIds: number[]) {
  await Promise.all(participantIds.map(async (participantId) => {
    const conversations = await listCommunityConversations(participantId);
    sendToUser(participantId, { type: "conversations", conversations });
  }));
}

export async function publishPersistedCommunityMessage(message: any) {
  const conversationId = String(message.conversation_id);
  const messageId = Number(message.id);
  const senderUserId = Number(message.sender_user_id);
  const participantIds = await listCommunityConversationParticipantIds(conversationId);

  const deliveryRows: any[] = [];
  for (const participantId of participantIds) {
    if (participantId === senderUserId || !isUserConnected(participantId)) continue;
    const rows = await markCommunityMessagesDelivered(
      participantId,
      conversationId,
      messageId
    );
    deliveryRows.push(...rows);
  }
  await publishStatusRows(deliveryRows);

  const persisted = await getCommunityMessageForUser(senderUserId, messageId);
  await Promise.all(participantIds.map(async (participantId) => {
    const conversations = await listCommunityConversations(participantId);
    sendToUser(participantId, {
      type: "message",
      cursor: messageId,
      message: {
        ...persisted,
        is_mine: participantId === senderUserId
      },
      conversations
    });
  }));
}

export async function synchronizeCommunityPeer(
  userId: number,
  afterValue: unknown,
  peer: CommunitySocketPeer
) {
  const updates = await listCommunityUpdates(userId, afterValue);
  const deliveryRows = await markAllCommunityMessagesDelivered(userId);
  await publishStatusRows(deliveryRows);

  const deliveryById = new Map(deliveryRows.map((row) => [Number(row.id), row]));
  const messages = updates.messages.map((message: any) => {
    const delivery = deliveryById.get(Number(message.id));
    return delivery
      ? {
          ...message,
          delivered_at: delivery.delivered_at ?? message.delivered_at,
          read_at: delivery.read_at ?? message.read_at
        }
      : message;
  });

  safeSend(peer, {
    type: "sync",
    ...updates,
    messages
  });
}

export async function publishCommunityReadResult(userId: number, result: any) {
  await publishStatusRows(result.read_messages ?? []);
  const participantIds = await listCommunityConversationParticipantIds(
    result.conversation_id
  );
  await publishConversationSnapshots(participantIds);
  sendToUser(userId, {
    type: "read_ack",
    conversation_id: result.conversation_id,
    last_read_message_id: result.last_read_message_id
  });
}
