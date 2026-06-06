<script setup lang="ts">
const route = useRoute()
const { data: dueno } = await useFetch(`/api/duenos/${route.params.id}`)
</script>

<template>
  <div v-if="dueno">
    <h1 class="text-5xl font-bold mb-8">{{ dueno.nombre }}</h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Teléfono</p>
        <h2 class="text-2xl font-bold mt-2">{{ dueno.telefono }}</h2>
      </div>
      <div class="bg-white rounded-3xl p-6 border border-gray-100 md:col-span-2">
        <p class="text-gray-500">Dirección</p>
        <h2 class="text-2xl font-bold mt-2">{{ dueno.direccion }}</h2>
      </div>
    </div>
  </div>
</template>