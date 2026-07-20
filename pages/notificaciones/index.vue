<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
const { data, refresh } = await useFetch("/api/notifications");
const items = computed(() => data.value?.items ?? []);
const activeAction = ref<string | null>(null);
let stream: EventSource | null = null;

async function read(item: any) {
  if (activeAction.value) return;
  activeAction.value = `read-${item.id}`;
  try {
    if (!item.is_read) await $fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
    if (item.entity_type === "bovino_transfer") await navigateTo("/transferencias");
    else if (item.entity_type === "friend_request") await navigateTo("/amigos");
    else if (item.entity_type === "community_conversation") await navigateTo(`/mensajes?conversation=${item.entity_id}`);
    await refresh();
  } finally {
    activeAction.value = null;
  }
}

async function readAll() {
  if (activeAction.value) return;
  activeAction.value = "read-all";
  try {
    await $fetch("/api/notifications/read-all", { method: "POST" });
    await refresh();
  } finally {
    activeAction.value = null;
  }
}

onMounted(() => {
  stream = new EventSource("/api/notifications/stream");
  stream.addEventListener("notifications", () => refresh());
});
onBeforeUnmount(() => stream?.close());
</script>

<template>
  <div class="max-w-4xl">
    <div class="flex items-center justify-between mb-8">
      <div><h1 class="text-4xl font-bold">Notificaciones</h1><p class="text-gray-500 mt-2">Actividad reciente de tu cuenta.</p></div>
      <button :disabled="Boolean(activeAction)" class="px-4 py-2 bg-white border rounded-xl disabled:opacity-50" @click="readAll">
        {{ activeAction === "read-all" ? "Procesando..." : "Marcar todas como leidas" }}
      </button>
    </div>
    <div class="bg-white border border-gray-100 rounded-3xl overflow-hidden">
      <button v-for="item in items" :key="item.id" :disabled="Boolean(activeAction)" class="w-full text-left p-5 border-b flex gap-4 hover:bg-gray-50 disabled:opacity-60" @click="read(item)">
        <span class="mt-2 w-2 h-2 rounded-full shrink-0" :class="item.is_read ? 'bg-gray-200' : 'bg-emerald-600'" />
        <span class="flex-1"><span class="font-semibold block">{{ item.title }}</span><span class="text-gray-600 block mt-1">{{ item.body }}</span><span class="text-xs text-gray-400 block mt-2">{{ new Date(item.created_at).toLocaleString() }}</span></span>
      </button>
      <p v-if="!items.length" class="p-10 text-center text-gray-500">No tienes notificaciones.</p>
    </div>
  </div>
</template>
