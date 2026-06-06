<script setup lang="ts">
const form = reactive({
  nombre: "",
  telefono: "",
  direccion: "",
})

async function crear() {
  await $fetch("/api/duenos", { method: "POST", body: form })
  await navigateTo("/duenos")
}
</script>

<template>
  <div>
    <h1 class="text-4xl font-bold mb-8">Nuevo dueño</h1>

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl space-y-6">
      <input v-model="form.nombre" placeholder="Nombre" class="w-full border border-gray-200 rounded-2xl p-4" />
      <input v-model="form.telefono" placeholder="Teléfono" class="w-full border border-gray-200 rounded-2xl p-4" />
      <textarea v-model="form.direccion" placeholder="Dirección" class="w-full border border-gray-200 rounded-2xl p-4 h-32" />
      <button @click="crear" class="bg-black text-white px-6 py-4 rounded-2xl">Guardar</button>
    </div>
  </div>
</template>