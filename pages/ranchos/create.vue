<script setup lang="ts">
const { data: duenos } = await useFetch("/api/duenos")

const form = reactive({
  nombre: "",
  ubicacion: "",
  dueno_id: null as number | null,
})

async function crear() {
  await $fetch("/api/ranchos", { method: "POST", body: form })
  await navigateTo("/ranchos")
}
</script>

<template>
  <div>
    <h1 class="text-4xl font-bold mb-8">Nuevo rancho</h1>

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl space-y-6">
      <input v-model="form.nombre" placeholder="Nombre" class="w-full border border-gray-200 rounded-2xl p-4" />
      <textarea v-model="form.ubicacion" placeholder="Ubicación" class="w-full border border-gray-200 rounded-2xl p-4 h-28" />
      <select v-model="form.dueno_id" class="w-full border border-gray-200 rounded-2xl p-4">
        <option :value="null">Selecciona dueño</option>
        <option v-for="d in duenos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
      </select>
      <button @click="crear" class="bg-black text-white px-6 py-4 rounded-2xl">Guardar</button>
    </div>
  </div>
</template>