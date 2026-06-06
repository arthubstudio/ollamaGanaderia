<script setup lang="ts">
const search = ref("")
const { data: duenos, refresh } = await useFetch("/api/duenos")

const filtered = computed(() => {
  const list = duenos.value ?? []
  const q = search.value.toLowerCase()
  return list.filter((d: any) =>
    (d.nombre ?? "").toLowerCase().includes(q) ||
    (d.telefono ?? "").toLowerCase().includes(q) ||
    (d.direccion ?? "").toLowerCase().includes(q)
  )
})

async function eliminarDueno(id: number) {
  await $fetch(`/api/duenos/${id}`, { method: "DELETE" })
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold">Dueños</h1>
        <p class="text-gray-500 mt-2">Administración de propietarios.</p>
      </div>

      <NuxtLink to="/duenos/create" class="bg-black text-white px-6 py-4 rounded-2xl font-semibold">
        Nuevo dueño
      </NuxtLink>
    </div>

    <input
      v-model="search"
      type="text"
      placeholder="Buscar dueño..."
      class="w-full bg-white border border-gray-200 rounded-2xl p-4 outline-none mb-6"
    />

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left p-5">Nombre</th>
            <th class="text-left p-5">Teléfono</th>
            <th class="text-left p-5">Dirección</th>
            <th class="text-left p-5">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dueno in filtered" :key="dueno.id" class="border-b border-gray-100 hover:bg-gray-50">
            <td class="p-5 font-semibold">{{ dueno.nombre }}</td>
            <td class="p-5">{{ dueno.telefono }}</td>
            <td class="p-5">{{ dueno.direccion }}</td>
            <td class="p-5">
              <RowActions
                :view-to="`/duenos/${dueno.id}`"
                :edit-to="`/duenos/${dueno.id}/edit`"
                :delete-action="() => eliminarDueno(dueno.id)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>