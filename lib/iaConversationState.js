const pendingByConversation = new Map();
const contextByConversation = new Map();
const PENDING_TTL_MS = 15 * 60 * 1000;

function keyFrom(conversationId, usuarioId) {
  return conversationId ? `conversation:${conversationId}` : `user:${usuarioId ?? "anonymous"}`;
}

export function getPendingIaAction(conversationId, usuarioId) {
  const key = keyFrom(conversationId, usuarioId);
  const pending = pendingByConversation.get(key) ?? null;
  if (!pending) return null;

  const lastUpdate = Number(pending.updatedAt ?? pending.createdAt ?? 0);
  if (!lastUpdate || Date.now() - lastUpdate > PENDING_TTL_MS) {
    pendingByConversation.delete(key);
    return null;
  }

  return pending;
}

export function setPendingIaAction(conversationId, usuarioId, pending) {
  const key = keyFrom(conversationId, usuarioId);
  const previous = pendingByConversation.get(key);
  const now = Date.now();
  const args = { ...(pending.args ?? {}) };
  pendingByConversation.set(key, {
    ...pending,
    type: pending.type ?? pending.tool,
    args,
    params: args,
    missing: [...(pending.missing ?? [])],
    createdAt: previous?.tool === pending.tool
      ? previous.createdAt
      : now,
    updatedAt: now,
    status: pending.status ?? (pending.awaitingConfirmation
      ? "awaiting_confirmation"
      : "collecting_parameters")
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
