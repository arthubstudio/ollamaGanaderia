<script setup lang="ts">
const route = useRoute()
const { data: rancho } = await useFetch(`/api/ranchos/${route.params.id}`)
const { data: duenos } = await useFetch("/api/duenos")

const form = reactive({
  nombre: "",
  ubicacion: "",
  dueno_ids: [] as number[],
})
const loading = ref(false)
const errorMessage = ref("")

watchEffect(() => {
  if (rancho.value) {
    form.nombre = rancho.value.nombre ?? ""
    form.ubicacion = rancho.value.ubicacion ?? ""
    form.dueno_ids = Array.isArray(rancho.value.duenos)
      ? rancho.value.duenos.map((item: any) => Number(item.id))
      : []
  }
})

async function guardar() {
  if (loading.value) return
  errorMessage.value = ""
  try {
    loading.value = true
    await $fetch(`/api/ranchos/${route.params.id}`, {
      method: "PUT",
      body: form,
    })
    await navigateTo(`/ranchos/${route.params.id}`)
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? "No se pudo actualizar el rancho."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-4xl font-bold mb-8">Editar rancho</h1>

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl space-y-6">
      <input v-model="form.nombre" placeholder="Nombre" class="w-full border border-gray-200 rounded-2xl p-4" />
      <textarea v-model="form.ubicacion" placeholder="Ubicación" class="w-full border border-gray-200 rounded-2xl p-4 h-28" />
      <fieldset class="space-y-2">
        <legend class="font-semibold mb-2">Dueños del rancho</legend>
        <label v-for="d in duenos ?? []" :key="d.id" class="flex items-center gap-3">
          <input v-model="form.dueno_ids" type="checkbox" :value="Number(d.id)" />
          <span>{{ d.nombre }}</span>
        </label>
      </fieldset>
      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      <button @click="guardar" :disabled="loading" class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50">
        {{ loading ? "Actualizando..." : "Actualizar" }}
      </button>
    </div>
  </div>
</template>
