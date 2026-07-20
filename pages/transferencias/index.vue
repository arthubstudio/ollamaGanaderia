<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
const route = useRoute();
const tab = ref<"received" | "sent">("received");
const form = reactive({ bovino_id: Number(route.query.bovino) || null as number | null, usuario_destino: "", destination_rancho_id: null as number | null, message: "" });
const userSearch = ref("");
const matches = ref<any[]>([]);
const errorMessage = ref("");
const searchLoading = ref(false);
const activeAction = ref<string | null>(null);

const { data: bovinos } = await useFetch("/api/bovinos");
const { data: ranchos } = await useFetch("/api/ranchos");
const { data: transfers, refresh } = await useFetch("/api/transfers");
const visibleTransfers = computed(() => (transfers.value ?? []).filter((item: any) => item.direction === tab.value));

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchVersion = 0;
watch(userSearch, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  const version = ++searchVersion;
  if (value.trim().length < 2) {
    matches.value = [];
    searchLoading.value = false;
    return;
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true;
    try {
      const result: any[] = await $fetch("/api/users/search", { query: { q: value } });
      if (version === searchVersion) matches.value = result;
    } catch (error: any) {
      errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo buscar usuarios.";
    } finally {
      if (version === searchVersion) searchLoading.value = false;
    }
  }, 250);
});

function selectUser(user: any) {
  form.usuario_destino = user.email;
  userSearch.value = `${user.nombre} (${user.email})`;
  matches.value = [];
}

async function sendTransfer() {
  if (activeAction.value) return;
  errorMessage.value = "";
  activeAction.value = "send";
  try {
    const result: any = await $fetch("/api/transfers", { method: "POST", body: form });
    if (!result.ok) {
      matches.value = result.matches ?? [];
      errorMessage.value = result.reason === "ambiguous" ? "Selecciona el correo exacto del destinatario." : "No se encontro al usuario destino.";
      return;
    }
    Object.assign(form, { bovino_id: null, usuario_destino: "", destination_rancho_id: null, message: "" });
    userSearch.value = "";
    tab.value = "sent";
    await refresh();
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo enviar la transferencia.";
  } finally {
    activeAction.value = null;
  }
}

async function act(id: number, action: "accept" | "reject" | "cancel") {
  if (activeAction.value) return;
  activeAction.value = `${action}-${id}`;
  errorMessage.value = "";
  try {
    const body = action === "accept" ? { destination_rancho_id: form.destination_rancho_id } : undefined;
    await $fetch(`/api/transfers/${id}/${action}`, { method: "POST", body });
    await refresh();
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? `No se pudo ${action} la transferencia.`;
  } finally {
    activeAction.value = null;
  }
}

const statusClass = (status: string) => ({
  PENDING: "bg-amber-50 text-amber-700", ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700", CANCELLED: "bg-gray-100 text-gray-600", EXPIRED: "bg-gray-100 text-gray-500"
}[status] ?? "bg-gray-100");
</script>

<template>
  <div>
    <div class="mb-8"><h1 class="text-4xl font-bold">Transferencias</h1><p class="text-gray-500 mt-2">Solicitudes entre cuentas con historial permanente.</p></div>
    <div class="grid xl:grid-cols-[380px_1fr] gap-8">
      <form class="bg-white rounded-3xl border border-gray-100 p-6 h-fit space-y-4" @submit.prevent="sendTransfer">
        <h2 class="text-xl font-bold">Enviar bovino</h2>
        <select v-model="form.bovino_id" required class="w-full border rounded-xl p-3"><option :value="null">Selecciona bovino</option><option v-for="item in bovinos" :key="item.id" :value="Number(item.id)">{{ item.nombre }} ({{ item.numero_arete }})</option></select>
        <div class="relative">
          <input v-model="userSearch" placeholder="Nombre o correo del usuario" class="w-full border rounded-xl p-3" />
          <div v-if="matches.length" class="absolute z-10 top-full mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden">
            <button v-for="user in matches" :key="user.id" type="button" class="block w-full text-left p-3 hover:bg-gray-50" @click="selectUser(user)"><strong>{{ user.nombre }}</strong><span class="block text-xs text-gray-500">{{ user.email }}</span></button>
          </div>
          <p v-if="searchLoading" class="mt-2 text-xs text-gray-500">Buscando...</p>
        </div>
        <textarea v-model="form.message" placeholder="Mensaje opcional" class="w-full border rounded-xl p-3 h-24" />
        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
        <button :disabled="Boolean(activeAction)" class="w-full bg-black text-white rounded-xl p-3 font-semibold disabled:opacity-50">
          {{ activeAction === "send" ? "Enviando..." : "Crear solicitud" }}
        </button>
      </form>

      <div>
        <div class="flex gap-2 mb-4">
          <button class="px-4 py-2 rounded-xl" :class="tab === 'received' ? 'bg-black text-white' : 'bg-white border'" @click="tab = 'received'">Recibidas</button>
          <button class="px-4 py-2 rounded-xl" :class="tab === 'sent' ? 'bg-black text-white' : 'bg-white border'" @click="tab = 'sent'">Enviadas</button>
        </div>
        <div class="space-y-4">
          <article v-for="item in visibleTransfers" :key="item.id" class="bg-white border border-gray-100 rounded-2xl p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div><h3 class="font-bold text-lg">{{ item.bovino_nombre }}</h3><p class="text-gray-500 text-sm">{{ item.numero_arete }}</p></div>
              <span class="px-3 py-1 rounded-full text-xs font-bold" :class="statusClass(item.status)">{{ item.status }}</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-3 text-sm mt-4">
              <p><span class="text-gray-500">Origen:</span> {{ item.source_user_name }}<br><span class="text-xs text-gray-400">{{ item.source_user_email }}</span></p>
              <p><span class="text-gray-500">Destino:</span> {{ item.destination_user_name }}<br><span class="text-xs text-gray-400">{{ item.destination_user_email }}</span></p>
            </div>
            <p class="text-xs text-gray-400 mt-4">{{ new Date(item.requested_at).toLocaleString() }}</p>
            <div v-if="item.status === 'PENDING'" class="flex flex-wrap gap-2 mt-4">
              <template v-if="item.direction === 'received'">
                <select v-model="form.destination_rancho_id" class="border rounded-xl px-3 py-2 text-sm"><option :value="null">Sin rancho destino</option><option v-for="rancho in ranchos" :key="rancho.id" :value="Number(rancho.id)">{{ rancho.nombre }}</option></select>
                <button :disabled="Boolean(activeAction)" class="bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50" @click="act(item.id, 'accept')">{{ activeAction === `accept-${item.id}` ? "Procesando..." : "Aceptar" }}</button>
                <button :disabled="Boolean(activeAction)" class="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm disabled:opacity-50" @click="act(item.id, 'reject')">Rechazar</button>
              </template>
              <button v-else :disabled="Boolean(activeAction)" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm disabled:opacity-50" @click="act(item.id, 'cancel')">{{ activeAction === `cancel-${item.id}` ? "Procesando..." : "Cancelar" }}</button>
            </div>
          </article>
          <p v-if="!visibleTransfers.length" class="bg-white border rounded-2xl p-10 text-center text-gray-500">No hay transferencias en esta seccion.</p>
        </div>
      </div>
    </div>
  </div>
</template>
