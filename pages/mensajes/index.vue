<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
const route = useRoute();
const usuario = useState<any>("usuario", () => null);
const activeId = ref(String(route.query.conversation ?? ""));
const messages = ref<any[]>([]);
const draft = ref("");
const chatError = ref("");
const socketReady = ref(false);
const { data: conversations } = await useFetch("/api/community/conversations");
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempt = 0;
let destroyed = false;
const lastMessageId = ref(0);
const statusByMessageId = new Map<number, any>();
const lastReadByConversation = new Map<string, number>();
const acknowledgementTimers = new Map<string, ReturnType<typeof setTimeout>>();

const activeConversation = computed(() =>
  (conversations.value ?? []).find((item: any) => String(item.id) === activeId.value)
);

function updateCursor(items: any[]) {
  for (const item of items) {
    const id = Number(item?.last_message_id ?? item?.id ?? 0);
    if (Number.isFinite(id)) lastMessageId.value = Math.max(lastMessageId.value, id);
  }
}

function clearAcknowledgementTimer(clientMessageId: unknown) {
  if (!clientMessageId) return;
  const key = String(clientMessageId);
  const timer = acknowledgementTimers.get(key);
  if (timer) clearTimeout(timer);
  acknowledgementTimers.delete(key);
}

function mergeMessage(incoming: any) {
  const serverId = Number(incoming?.id);
  const clientMessageId = incoming?.client_message_id
    ? String(incoming.client_message_id)
    : "";
  const index = messages.value.findIndex((item) => {
    const sameServerId = Number.isFinite(serverId) && Number(item.id) === serverId;
    const sameClientId = clientMessageId &&
      String(item.client_message_id ?? "") === clientMessageId;
    return sameServerId || sameClientId;
  });
  const cachedStatus = Number.isFinite(serverId)
    ? statusByMessageId.get(serverId)
    : null;
  const normalized = {
    ...(index >= 0 ? messages.value[index] : {}),
    ...incoming,
    ...cachedStatus,
    pending: false,
    failed: false
  };

  if (index >= 0) {
    messages.value.splice(index, 1, normalized);
  } else {
    messages.value.push(normalized);
  }
  clearAcknowledgementTimer(clientMessageId);
  updateCursor([incoming]);
}

function mergeMessages(incoming: any[]) {
  for (const message of incoming) mergeMessage(message);
  messages.value.sort((left, right) => {
    const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    if (timeDifference) return timeDifference;
    const leftId = Number(left.id);
    const rightId = Number(right.id);
    if (Number.isFinite(leftId) && Number.isFinite(rightId)) return leftId - rightId;
    return 0;
  });
}

function applyConversations(incoming: any[]) {
  conversations.value = incoming;
  updateCursor(incoming);
}

function sendSocketEvent(payload: Record<string, unknown>) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function applyStatusUpdates(updates: any[]) {
  for (const update of updates) {
    const messageId = Number(update.id);
    if (!Number.isFinite(messageId)) continue;
    const previous = statusByMessageId.get(messageId) ?? {};
    const merged = { ...previous, ...update };
    statusByMessageId.set(messageId, merged);
    const index = messages.value.findIndex((item) => Number(item.id) === messageId);
    if (index >= 0) {
      messages.value.splice(index, 1, { ...messages.value[index], ...merged });
    }
  }
}

async function markActiveConversationRead(messageId: number) {
  if (!activeId.value || !messageId) return;
  const conversationId = activeId.value;
  const previousReadId = lastReadByConversation.get(conversationId) ?? 0;
  if (messageId <= previousReadId) return;
  lastReadByConversation.set(conversationId, messageId);
  const active = activeConversation.value;
  if (active) active.unread_count = 0;

  if (sendSocketEvent({
    type: "read",
    conversation_id: conversationId,
    message_id: messageId
  })) return;

  await $fetch(`/api/community/conversations/${conversationId}/read`, {
    method: "POST",
    body: { message_id: messageId }
  }).catch(() => {
    lastReadByConversation.set(conversationId, previousReadId);
  });
}

async function applySocketPayload(payload: any) {
  if (payload.type === "ready") {
    socketReady.value = true;
    return;
  }

  if (payload.type === "conversations") {
    if (Array.isArray(payload.conversations)) applyConversations(payload.conversations);
    return;
  }

  if (payload.type === "status") {
    applyStatusUpdates(payload.updates ?? []);
    return;
  }

  if (payload.type === "read_ack") {
    if (String(payload.conversation_id) === activeId.value && activeConversation.value) {
      activeConversation.value.unread_count = 0;
    }
    return;
  }

  if (payload.type === "error") {
    chatError.value = String(payload.message || "No se pudo enviar el mensaje.");
    const clientMessageId = String(payload.client_message_id ?? "");
    const pending = messages.value.find(
      (item) => String(item.client_message_id ?? "") === clientMessageId
    );
    if (pending) {
      pending.pending = false;
      pending.failed = true;
      pending.error_message = chatError.value;
      clearAcknowledgementTimer(clientMessageId);
    }
    return;
  }

  if (payload.type === "message") {
    if (Array.isArray(payload.conversations)) applyConversations(payload.conversations);
    const message = payload.message;
    lastMessageId.value = Math.max(lastMessageId.value, Number(payload.cursor) || 0);
    if (message && String(message.conversation_id) === activeId.value) {
      mergeMessage(message);
      if (Number(message.sender_user_id) !== Number(usuario.value?.id)) {
        await markActiveConversationRead(Number(message.id));
      }
    }
    return;
  }

  if (payload.type === "sync") {
    if (Array.isArray(payload.conversations)) applyConversations(payload.conversations);
    const incoming = Array.isArray(payload.messages) ? payload.messages : [];
    lastMessageId.value = Math.max(lastMessageId.value, Number(payload.cursor) || 0);
    const activeIncoming = incoming.filter(
      (message: any) => String(message.conversation_id) === activeId.value
    );
    if (activeIncoming.length) {
      mergeMessages(activeIncoming);
      const remoteIds = activeIncoming
        .filter((message: any) => Number(message.sender_user_id) !== Number(usuario.value?.id))
        .map((message: any) => Number(message.id));
      if (remoteIds.length) await markActiveConversationRead(Math.max(...remoteIds));
    }
    if (payload.has_more) {
      sendSocketEvent({ type: "sync", after: lastMessageId.value });
    }
  }
}

function clearHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function scheduleReconnect() {
  if (destroyed || reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt, 8000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectCommunitySocket();
  }, delay);
}

function connectCommunitySocket() {
  if (destroyed || !import.meta.client) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const nextSocket = new WebSocket(
    `${protocol}//${window.location.host}/_ws/community?after=${lastMessageId.value}`
  );
  socket = nextSocket;
  socketReady.value = false;

  nextSocket.onopen = () => {
    if (socket !== nextSocket) return;
    reconnectAttempt = 0;
    socketReady.value = true;
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      sendSocketEvent({ type: "ping" });
    }, 25000);
  };
  nextSocket.onmessage = (event) => {
    try {
      applySocketPayload(JSON.parse(event.data)).catch(() => null);
    } catch {
      chatError.value = "Se recibio un evento de chat no valido.";
    }
  };
  nextSocket.onerror = () => nextSocket.close();
  nextSocket.onclose = () => {
    if (socket !== nextSocket) return;
    socket = null;
    socketReady.value = false;
    clearHeartbeat();
    scheduleReconnect();
  };
}

function disconnectCommunitySocket() {
  socketReady.value = false;
  clearHeartbeat();
  const disconnectedSocket = socket;
  socket = null;
  if (disconnectedSocket && disconnectedSocket.readyState < WebSocket.CLOSING) {
    disconnectedSocket.close(1001, "Conexion de red perdida");
  }
  scheduleReconnect();
}

function reconnectCommunitySocket() {
  reconnectAttempt = 0;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  disconnectCommunitySocket();
  connectCommunitySocket();
}

async function loadConversation(id: string) {
  const conversationId = String(id);
  activeId.value = conversationId;
  chatError.value = "";
  try {
    const loaded: any[] = await $fetch(
      `/api/community/conversations/${conversationId}/messages`
    );
    messages.value = [];
    mergeMessages(loaded);
    const lastId = Number(loaded[loaded.length - 1]?.id ?? 0);
    if (lastId) await markActiveConversationRead(lastId);
    await navigateTo(
      { path: "/mensajes", query: { conversation: conversationId } },
      { replace: true }
    );
  } catch (error: any) {
    chatError.value = error?.data?.message || "No se pudo abrir la conversacion.";
  }
}

async function persistPendingMessage(
  conversationId: string,
  clientMessageId: string,
  content: string
) {
  const pending = messages.value.find(
    (item) => String(item.client_message_id ?? "") === clientMessageId
  );
  if (!pending?.pending) return;

  try {
    const sent: any = await $fetch(
      `/api/community/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: { content, client_message_id: clientMessageId }
      }
    );
    mergeMessage({
      ...sent,
      sender_name: usuario.value?.nombre,
      is_mine: true
    });
    const latestConversations: any[] = await $fetch("/api/community/conversations");
    applyConversations(latestConversations);
  } catch (error: any) {
    clearAcknowledgementTimer(clientMessageId);
    pending.pending = false;
    pending.failed = true;
    pending.error_message = error?.data?.message || "No se pudo enviar el mensaje.";
    chatError.value = pending.error_message;
    if (!draft.value) draft.value = content;
  }
}

function scheduleHttpAcknowledgement(
  conversationId: string,
  clientMessageId: string,
  content: string
) {
  clearAcknowledgementTimer(clientMessageId);
  acknowledgementTimers.set(clientMessageId, setTimeout(() => {
    acknowledgementTimers.delete(clientMessageId);
    persistPendingMessage(conversationId, clientMessageId, content).catch(() => null);
  }, 4000));
}

async function send() {
  const content = draft.value.trim();
  if (!content || !activeId.value) return;
  const clientMessageId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const optimisticId = `pending-${clientMessageId}`;
  const optimistic = {
    id: optimisticId,
    client_message_id: clientMessageId,
    conversation_id: activeId.value,
    sender_user_id: usuario.value?.id,
    sender_name: usuario.value?.nombre,
    content,
    created_at: new Date().toISOString(),
    is_mine: true,
    pending: true
  };

  messages.value.push(optimistic);
  draft.value = "";
  chatError.value = "";

  const sentOverSocket = sendSocketEvent({
    type: "send",
    conversation_id: activeId.value,
    content,
    client_message_id: clientMessageId
  });
  if (sentOverSocket) {
    scheduleHttpAcknowledgement(activeId.value, clientMessageId, content);
  } else {
    await persistPendingMessage(activeId.value, clientMessageId, content);
  }
}

function messageStatus(message: any) {
  const isMine = message.is_mine ||
    Number(message.sender_user_id) === Number(usuario.value?.id);
  if (!isMine) {
    return new Date(message.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  if (message.pending) return "Enviando...";
  if (message.failed) return "No enviado";
  if (message.read_at) return "Leido";
  if (message.delivered_at) return "Entregado";
  return "Enviado";
}

onMounted(() => {
  updateCursor(conversations.value ?? []);
  connectCommunitySocket();
  if (activeId.value) loadConversation(activeId.value);
  window.addEventListener("online", reconnectCommunitySocket);
  window.addEventListener("offline", disconnectCommunitySocket);
});
onBeforeUnmount(() => {
  destroyed = true;
  window.removeEventListener("online", reconnectCommunitySocket);
  window.removeEventListener("offline", disconnectCommunitySocket);
  socket?.close(1000, "Pagina cerrada");
  if (reconnectTimer) clearTimeout(reconnectTimer);
  clearHeartbeat();
  for (const timer of acknowledgementTimers.values()) clearTimeout(timer);
  acknowledgementTimers.clear();
});
</script>

<template>
  <div :data-realtime-state="socketReady ? 'connected' : 'connecting'">
    <div class="mb-6"><h1 class="text-4xl font-bold">Mensajes</h1><p class="text-gray-500 mt-2">Conversaciones privadas entre contactos.</p></div>
    <div class="bg-white border border-gray-100 rounded-3xl overflow-hidden grid lg:grid-cols-[320px_1fr] h-[calc(100vh-210px)] min-h-[560px]">
      <aside class="border-r overflow-y-auto">
        <button v-for="item in conversations" :key="item.id" class="w-full text-left p-4 border-b hover:bg-gray-50" :class="activeId === item.id ? 'bg-emerald-50' : ''" @click="loadConversation(item.id)">
          <div class="flex justify-between gap-3"><strong class="truncate">{{ item.contact_name }}</strong><span v-if="item.unread_count" class="shrink-0 min-w-5 h-5 px-1 rounded-full bg-emerald-700 text-white text-xs flex items-center justify-center">{{ item.unread_count }}</span></div>
          <p class="text-sm text-gray-500 truncate mt-1">{{ item.last_message || "Sin mensajes" }}</p>
        </button>
        <p v-if="!conversations?.length" class="p-8 text-center text-gray-500">Inicia una conversacion desde Contactos.</p>
      </aside>

      <section v-if="activeConversation" class="flex flex-col min-w-0">
        <header class="p-4 border-b"><strong>{{ activeConversation.contact_name }}</strong><p class="text-xs text-gray-500">{{ activeConversation.contact_email }}</p></header>
        <div data-testid="message-list" class="flex-1 overflow-y-auto p-5 space-y-3 bg-stone-50">
          <div v-for="message in messages" :key="message.id" class="flex" :class="message.is_mine || Number(message.sender_user_id) === Number(usuario?.id) ? 'justify-end' : 'justify-start'">
            <div class="max-w-[75%] rounded-2xl px-4 py-3" :class="message.is_mine || Number(message.sender_user_id) === Number(usuario?.id) ? 'bg-emerald-700 text-white' : 'bg-white border'">
              <p class="whitespace-pre-wrap break-words">{{ message.content }}</p><time class="text-[10px] opacity-60 block mt-1">{{ messageStatus(message) }}</time>
            </div>
          </div>
        </div>
        <form class="p-4 border-t flex gap-3" @submit.prevent="send"><input v-model="draft" placeholder="Escribe un mensaje..." class="flex-1 border rounded-xl px-4" /><button class="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center" title="Enviar"><Icon name="lucide:send" class="size-5" /></button></form>
      </section>
      <div v-else class="hidden lg:flex items-center justify-center text-gray-500">Selecciona una conversacion.</div>
    </div>
  </div>
</template>
