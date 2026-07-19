<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
const route = useRoute();
const bovinoId = Number(route.params.id);
const { data: bovino } = await useFetch(`/api/bovinos/${bovinoId}`);
const { data: timeline } = await useFetch(`/api/bovinos/${bovinoId}/ownership-history`);
const eventLabel = (type: string) => ({ REQUESTED: "Transferencia solicitada", ACCEPTED: "Transferencia aceptada", REJECTED: "Transferencia rechazada", CANCELLED: "Transferencia cancelada", EXPIRED: "Transferencia expirada" }[type] ?? type);
</script>

<template>
  <div class="max-w-4xl">
    <div class="flex items-center justify-between mb-8"><div><h1 class="text-4xl font-bold">Historial de {{ bovino?.nombre }}</h1><p class="text-gray-500 mt-2">{{ bovino?.numero_arete }}</p></div><NuxtLink :to="`/bovinos/${bovinoId}`" class="px-4 py-2 bg-white border rounded-xl">Volver</NuxtLink></div>
    <div class="relative pl-8 border-l-2 border-emerald-200 space-y-6">
      <article v-for="event in timeline" :key="event.id" class="relative bg-white border border-gray-100 rounded-2xl p-5">
        <span class="absolute -left-[42px] top-6 w-5 h-5 rounded-full bg-emerald-600 border-4 border-stone-100" />
        <div class="flex justify-between gap-4"><h2 class="font-bold">{{ eventLabel(event.event_type) }}</h2><time class="text-xs text-gray-400">{{ new Date(event.created_at).toLocaleString() }}</time></div>
        <p class="text-sm text-gray-600 mt-2">{{ event.from_user_name || "-" }} <span class="mx-2">→</span> {{ event.to_user_name || "-" }}</p>
        <p v-if="event.source_arete !== event.destination_arete && event.destination_arete" class="text-xs text-amber-700 mt-2">Arete reasignado por colision: {{ event.source_arete }} → {{ event.destination_arete }}</p>
      </article>
      <p v-if="!timeline?.length" class="bg-white border rounded-2xl p-8 text-gray-500">Todavia no existen transferencias entre cuentas para este bovino.</p>
    </div>
  </div>
</template>

