<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
})
const search = ref("")
const { data: vacunas, refresh } = await useFetch("/api/vacunas")

const filtered = computed(() => {
  const list = vacunas.value ?? []
  const q = search.value.toLowerCase()
  return list.filter((v: any) =>
    (v.nombre ?? "").toLowerCase().includes(q) ||
    (v.descripcion ?? "").toLowerCase().includes(q)
  )
})

async function eliminarVacuna(id: number) {
  await $fetch(`/api/vacunas/${id}`, { method: "DELETE" })
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold">Vacunas</h1>
        <p class="text-gray-500 mt-2">Catálogo sanitario.</p>
      </div>

      <NuxtLink
        to="/vacunas/create"
        class="bg-black text-white px-6 py-4 rounded-2xl font-semibold"
      >
        Nueva vacuna
      </NuxtLink>
    </div>

    <input
      v-model="search"
      type="text"
      placeholder="Buscar vacuna..."
      class="w-full bg-white border border-gray-200 rounded-2xl p-4 outline-none mb-6"
    />

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left p-5">Nombre</th>
            <th class="text-left p-5">Descripción</th>
            <th class="text-left p-5">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="vacuna in filtered"
            :key="vacuna.id"
            class="border-b border-gray-100 hover:bg-gray-50"
          >
            <td class="p-5 font-semibold">{{ vacuna.nombre }}</td>
            <td class="p-5">{{ vacuna.descripcion }}</td>
            <td class="p-5">
              <div class="flex gap-2">
                <NuxtLink
                  :to="`/vacunas/${vacuna.id}`"
                  class="px-3 py-2 rounded-xl text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Ver
                </NuxtLink>

                <NuxtLink
                  :to="`/vacunas/${vacuna.id}/edit`"
                  class="px-3 py-2 rounded-xl text-sm bg-black text-white"
                >
                  Editar
                </NuxtLink>

                <button
                  @click="eliminarVacuna(vacuna.id)"
                  class="px-3 py-2 rounded-xl text-sm bg-red-600 text-white"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>