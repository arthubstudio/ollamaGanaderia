<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
const route = useRoute();
const usuario = useState<any>("usuario", () => null);
const activeId = ref(String(route.query.conversation ?? ""));
const messages = ref<any[]>([]);
const draft = ref("");
const { data: conversations, refresh } = await useFetch("/api/community/conversations");
let stream: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const lastMessageId = ref(0);

const activeConversation = computed(() =>
  (conversations.value ?? []).find((item: any) => String(item.id) === activeId.value)
);

function updateCursor(items: any[]) {
  for (const item of items) {
    const id = Number(item?.id ?? item?.last_message_id ?? 0);
    if (Number.isFinite(id)) lastMessageId.value = Math.max(lastMessageId.value, id);
  }
}

function mergeMessages(incoming: any[]) {
  for (const message of incoming) {
    if (!messages.value.some((item) => String(item.id) === String(message.id))) {
      messages.value.push(message);
    }
  }
  messages.value.sort((left, right) => Number(left.id) - Number(right.id));
  updateCursor(incoming);
}

async function markActiveConversationRead(messageId: number) {
  if (!activeId.value || !messageId) return;
  await $fetch(`/api/community/conversations/${activeId.value}/read`, {
    method: "POST",
    body: { message_id: messageId }
  }).catch(() => null);

  const active = activeConversation.value;
  if (active) active.unread_count = 0;
}

async function applyCommunityUpdate(event: MessageEvent) {
  const payload = JSON.parse(event.data) as {
    cursor?: number;
    messages?: any[];
    conversations?: any[];
  };
  const incoming = payload.messages ?? [];

  if (Array.isArray(payload.conversations)) {
    conversations.value = payload.conversations;
    updateCursor(payload.conversations);
  }
  lastMessageId.value = Math.max(lastMessageId.value, Number(payload.cursor) || 0);

  const activeIncoming = incoming.filter(
    (message) => String(message.conversation_id) === activeId.value
  );
  if (activeIncoming.length) {
    mergeMessages(activeIncoming);
    const lastIncomingId = Number(activeIncoming[activeIncoming.length - 1]?.id ?? 0);
    const hasRemoteMessage = activeIncoming.some(
      (message) => Number(message.sender_user_id) !== Number(usuario.value?.id)
    );
    if (hasRemoteMessage) await markActiveConversationRead(lastIncomingId);
  }
}

function connectCommunityStream() {
  stream?.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);

  stream = new EventSource(`/api/community/stream?after=${lastMessageId.value}`);
  stream.addEventListener("community", (event) => {
    applyCommunityUpdate(event as MessageEvent).catch(() => null);
  });
  stream.onerror = () => {
    stream?.close();
    reconnectTimer = setTimeout(connectCommunityStream, 1500);
  };
}

async function loadConversation(id: string) {
  activeId.value = String(id);
  messages.value = await $fetch(`/api/community/conversations/${id}/messages`);
  updateCursor(messages.value);
  const active = activeConversation.value;
  if (active) active.unread_count = 0;
  await navigateTo({ path: "/mensajes", query: { conversation: id } }, { replace: true });
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

  try {
    const sent: any = await $fetch(`/api/community/conversations/${activeId.value}/messages`, {
      method: "POST",
      body: { content, client_message_id: clientMessageId }
    });
    const serverAlreadyPresent = messages.value.some((item) => String(item.id) === String(sent.id));
    const optimisticIndex = messages.value.findIndex((item) => item.id === optimisticId);
    if (serverAlreadyPresent && optimisticIndex >= 0) {
      messages.value.splice(optimisticIndex, 1);
    } else if (optimisticIndex >= 0) {
      messages.value.splice(optimisticIndex, 1, {
        ...sent,
        sender_name: usuario.value?.nombre,
        is_mine: true,
        pending: false
      });
    }
    updateCursor([sent]);
    await refresh();
  } catch {
    messages.value = messages.value.filter((item) => item.id !== optimisticId);
    draft.value = content;
  }
}

onMounted(() => {
  updateCursor(conversations.value ?? []);
  connectCommunityStream();
  if (activeId.value) loadConversation(activeId.value);
});
onBeforeUnmount(() => {
  stream?.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
});
</script>

<template>
  <div>
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
        <div class="flex-1 overflow-y-auto p-5 space-y-3 bg-stone-50">
          <div v-for="message in messages" :key="message.id" class="flex" :class="message.is_mine || Number(message.sender_user_id) === Number(usuario?.id) ? 'justify-end' : 'justify-start'">
            <div class="max-w-[75%] rounded-2xl px-4 py-3" :class="message.is_mine || Number(message.sender_user_id) === Number(usuario?.id) ? 'bg-emerald-700 text-white' : 'bg-white border'">
              <p class="whitespace-pre-wrap break-words">{{ message.content }}</p><time class="text-[10px] opacity-60 block mt-1">{{ message.pending ? "Enviando..." : new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</time>
            </div>
          </div>
        </div>
        <form class="p-4 border-t flex gap-3" @submit.prevent="send"><input v-model="draft" placeholder="Escribe un mensaje..." class="flex-1 border rounded-xl px-4" /><button class="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center" title="Enviar"><Icon name="lucide:send" class="size-5" /></button></form>
      </section>
      <div v-else class="hidden lg:flex items-center justify-center text-gray-500">Selecciona una conversacion.</div>
    </div>
  </div>
</template>
