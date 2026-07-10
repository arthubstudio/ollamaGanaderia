const pendingByConversation = new Map();
const contextByConversation = new Map();

function keyFrom(conversationId, usuarioId) {
  return conversationId ? `conversation:${conversationId}` : `user:${usuarioId ?? "anonymous"}`;
}

export function getPendingIaAction(conversationId, usuarioId) {
  return pendingByConversation.get(keyFrom(conversationId, usuarioId)) ?? null;
}

export function setPendingIaAction(conversationId, usuarioId, pending) {
  pendingByConversation.set(keyFrom(conversationId, usuarioId), {
    ...pending,
    updatedAt: Date.now()
  });
}

export function clearPendingIaAction(conversationId, usuarioId) {
  pendingByConversation.delete(keyFrom(conversationId, usuarioId));
}

export function getIaConversationContext(conversationId, usuarioId) {
  return contextByConversation.get(keyFrom(conversationId, usuarioId)) ?? null;
}

export function setIaConversationBovino(conversationId, usuarioId, bovino, intencion) {
  if (!bovino?.id || !bovino?.nombre) return;
  contextByConversation.set(keyFrom(conversationId, usuarioId), {
    ultima_entidad: "bovino",
    ultimo_bovino_id: Number(bovino.id),
    ultimo_bovino_nombre: String(bovino.nombre),
    ultima_intencion: intencion || null,
    updatedAt: Date.now()
  });
}
