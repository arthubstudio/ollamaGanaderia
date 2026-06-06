<script setup lang="ts">
const search = ref("")
const { data: ranchos, refresh } = await useFetch("/api/ranchos")
const { data: duenos } = await useFetch("/api/duenos")

const ownerName = (id: number) => duenos.value?.find((d: any) => d.id === id)?.nombre ?? "—"

const filtered = computed(() => {
  const list = ranchos.value ?? []
  const q = search.value.toLowerCase()
  return list.filter((r: any) =>
    (r.nombre ?? "").toLowerCase().includes(q) ||
    (r.ubicacion ?? "").toLowerCase().includes(q)
  )
})

async function eliminarRancho(id: number) {
  await $fetch(`/api/ranchos/${id}`, { method: "DELETE" })
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold">Ranchos</h1>
        <p class="text-gray-500 mt-2">Administración de propiedades.</p>
      </div>

      <NuxtLink to="/ranchos/create" class="bg-black text-white px-6 py-4 rounded-2xl font-semibold">
        Nuevo rancho
      </NuxtLink>
    </div>

    <input
      v-model="search"
      type="text"
      placeholder="Buscar rancho..."
      class="w-full bg-white border border-gray-200 rounded-2xl p-4 outline-none mb-6"
    />

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left p-5">Nombre</th>
            <th class="text-left p-5">Ubicación</th>
            <th class="text-left p-5">Dueño</th>
            <th class="text-left p-5">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rancho in filtered" :key="rancho.id" class="border-b border-gray-100 hover:bg-gray-50">
            <td class="p-5 font-semibold">{{ rancho.nombre }}</td>
            <td class="p-5">{{ rancho.ubicacion }}</td>
            <td class="p-5">{{ ownerName(rancho.dueno_id) }}</td>
            <td class="p-5">
              <RowActions
                :view-to="`/ranchos/${rancho.id}`"
                :edit-to="`/ranchos/${rancho.id}/edit`"
                :delete-action="() => eliminarRancho(rancho.id)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>