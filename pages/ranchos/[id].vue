<script setup lang="ts">
const route = useRoute()
const { data: rancho } = await useFetch(`/api/ranchos/${route.params.id}`)
const { data: duenos } = await useFetch("/api/duenos")

const ownerName = computed(() =>
  duenos.value?.find((d: any) => d.id === rancho.value?.dueno_id)?.nombre ?? "—"
)
</script>

<template>
  <div v-if="rancho">
    <h1 class="text-5xl font-bold mb-8">{{ rancho.nombre }}</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Ubicación</p>
        <h2 class="text-2xl font-bold mt-2">{{ rancho.ubicacion }}</h2>
      </div>
      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Dueño</p>
        <h2 class="text-2xl font-bold mt-2">{{ ownerName }}</h2>
      </div>
    </div>
  </div>
</template>