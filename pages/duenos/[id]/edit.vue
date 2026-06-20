<script setup lang="ts">
console.log("EDIT CARGADO");
const route = useRoute()
const { data: dueno } = await useFetch(`/api/duenos/${route.params.id}`)

const form = reactive({
  nombre: "",
  telefono: "",
  direccion: "",
})

watchEffect(() => {
  if (dueno.value) {
    form.nombre = dueno.value.nombre ?? ""
    form.telefono = dueno.value.telefono ?? ""
    form.direccion = dueno.value.direccion ?? ""
  }
})

async function guardar() {
  await $fetch(`/api/duenos/${route.params.id}`, {
    method: "PUT",
    body: form,
  })
  await navigateTo(`/duenos`)
}
</script>

<template>
  <div>
    <h1 class="text-4xl font-bold mb-8">Editar dueño</h1>

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl space-y-6">123
      <input v-model="form.nombre" placeholder="Nombre" class="w-full border border-gray-200 rounded-2xl p-4" />
      <input v-model="form.telefono" placeholder="Teléfono" class="w-full border border-gray-200 rounded-2xl p-4" />
      <textarea v-model="form.direccion" placeholder="Dirección" class="w-full border border-gray-200 rounded-2xl p-4 h-32" />
      <button @click="guardar" class="bg-black text-white px-6 py-4 rounded-2xl">Actualizar</button>
    </div>
  </div>
</template>