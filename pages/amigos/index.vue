<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
const search = ref("");
const matches = ref<any[]>([]);
const selected = ref<any>(null);
const message = ref("");
const feedback = ref("");
const { data: friends, refresh: refreshFriends } = await useFetch("/api/community/friends");
const { data: requests, refresh: refreshRequests } = await useFetch("/api/community/friends/requests");
const received = computed(() => (requests.value ?? []).filter((item: any) => item.direction === "received" && item.status === "PENDING"));
const sent = computed(() => (requests.value ?? []).filter((item: any) => item.direction === "sent" && item.status === "PENDING"));
let timer: ReturnType<typeof setTimeout> | null = null;

watch(search, (value) => {
  if (timer) clearTimeout(timer);
  selected.value = null;
  if (value.trim().length < 2) { matches.value = []; return; }
  timer = setTimeout(async () => matches.value = await $fetch("/api/users/search", { query: { q: value } }), 250);
});

async function sendRequest() {
  if (!selected.value) return;
  const result: any = await $fetch("/api/community/friends/requests", {
    method: "POST",
    body: { usuario_destino: selected.value.email, message: message.value }
  });
  feedback.value = result.autoAccepted ? "Ahora son contactos." : "Solicitud enviada.";
  search.value = ""; message.value = ""; matches.value = []; selected.value = null;
  await Promise.all([refreshFriends(), refreshRequests()]);
}

async function respond(id: number, action: "accept" | "reject") {
  await $fetch(`/api/community/friends/requests/${id}/${action}`, { method: "POST" });
  await Promise.all([refreshFriends(), refreshRequests()]);
}

async function openChat(contactId: number) {
  const conversation: any = await $fetch("/api/community/conversations", { method: "POST", body: { contact_user_id: contactId } });
  await navigateTo(`/mensajes?conversation=${conversation.id}`);
}
</script>

<template>
  <div>
    <div class="mb-8"><h1 class="text-4xl font-bold">Contactos</h1><p class="text-gray-500 mt-2">Tu comunidad privada de ganaderos.</p></div>
    <div class="grid lg:grid-cols-[360px_1fr] gap-8">
      <form class="bg-white border border-gray-100 rounded-3xl p-6 h-fit space-y-4" @submit.prevent="sendRequest">
        <h2 class="text-xl font-bold">Agregar contacto</h2>
        <div class="relative">
          <input v-model="search" placeholder="Nombre o correo" class="w-full border rounded-xl p-3" />
          <div v-if="matches.length && !selected" class="absolute top-full mt-1 w-full z-10 bg-white border rounded-xl shadow-lg overflow-hidden">
            <button v-for="user in matches" :key="user.id" type="button" class="block w-full text-left p-3 hover:bg-gray-50" @click="selected = user; search = `${user.nombre} (${user.email})`"><strong>{{ user.nombre }}</strong><span class="block text-xs text-gray-500">{{ user.email }}</span></button>
          </div>
        </div>
        <textarea v-model="message" placeholder="Mensaje opcional" class="w-full border rounded-xl p-3 h-20" />
        <p v-if="feedback" class="text-sm text-emerald-700">{{ feedback }}</p>
        <button :disabled="!selected" class="w-full bg-black text-white p-3 rounded-xl disabled:opacity-40">Enviar solicitud</button>
      </form>

      <div class="space-y-8">
        <section v-if="received.length"><h2 class="text-xl font-bold mb-3">Solicitudes recibidas</h2><div class="space-y-3"><article v-for="item in received" :key="item.id" class="bg-white border rounded-2xl p-4 flex items-center justify-between gap-4"><div><strong>{{ item.sender_name }}</strong><p class="text-xs text-gray-500">{{ item.sender_email }}</p></div><div class="flex gap-2"><button class="bg-emerald-700 text-white px-3 py-2 rounded-xl text-sm" @click="respond(item.id, 'accept')">Aceptar</button><button class="bg-red-50 text-red-700 px-3 py-2 rounded-xl text-sm" @click="respond(item.id, 'reject')">Rechazar</button></div></article></div></section>
        <section><div class="flex justify-between mb-3"><h2 class="text-xl font-bold">Mis contactos</h2><span v-if="sent.length" class="text-sm text-gray-500">{{ sent.length }} pendientes</span></div><div class="grid md:grid-cols-2 gap-3"><article v-for="friend in friends" :key="friend.id" class="bg-white border rounded-2xl p-5 flex items-center justify-between gap-4"><div class="min-w-0"><strong class="block truncate">{{ friend.nombre }}</strong><p class="text-xs text-gray-500 truncate">{{ friend.email }}</p></div><button title="Abrir conversacion" class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center" @click="openChat(friend.id)"><Icon name="lucide:message-square" class="size-5" /></button></article><p v-if="!friends?.length" class="bg-white border rounded-2xl p-8 text-gray-500">Todavia no tienes contactos.</p></div></section>
      </div>
    </div>
  </div>
</template>

