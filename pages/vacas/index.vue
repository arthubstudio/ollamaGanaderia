<script setup lang="ts">

const search = ref("");

const { data: vacas, refresh } =
  await useFetch("/api/vacas");



const filteredVacas = computed(() => {

  if (!vacas.value) return [];

  return vacas.value.filter((vaca: any) => {

    return (

      vaca.nombre
        ?.toLowerCase()
        .includes(search.value.toLowerCase())

      ||

      vaca.raza
        ?.toLowerCase()
        .includes(search.value.toLowerCase())

      ||

      vaca.numero_arete
        ?.toLowerCase()
        .includes(search.value.toLowerCase())

    );

  });

});



async function eliminarVaca(id: number) {
  const ok = confirm("¿Eliminar esta vaca?");
  if (!ok) return;

  try {
    await $fetch(`/api/vacas/${id}`, { method: "DELETE" });
    await refresh();
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar. Revisa registros relacionados.");
  }
}

</script>



<template>

  <div>

    <!-- HEADER -->

    <div
      class="flex items-center justify-between mb-8"
    >

      <div>

        <h1
          class="text-4xl font-bold"
        >
          Vacas
        </h1>

        <p
          class="text-gray-500 mt-2"
        >
          Gestión inteligente del ganado.
        </p>

      </div>



      <NuxtLink
        to="/vacas/create"
        class="bg-black text-white px-6 py-4 rounded-2xl font-semibold"
      >
        Nueva Vaca
      </NuxtLink>

    </div>



    <!-- SEARCH -->

    <div
      class="mb-6"
    >

      <input
        v-model="search"
        type="text"
        placeholder="Buscar vaca..."
        class="w-full bg-white border border-gray-200 rounded-2xl p-4 outline-none"
      />

    </div>



    <!-- TABLE -->

    <div
      class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
    >

      <table
        class="w-full"
      >

        <thead
          class="bg-gray-50 border-b border-gray-100"
        >

          <tr>

            <th class="text-left p-5">
              Arete
            </th>

            <th class="text-left p-5">
              Nombre
            </th>

            <th class="text-left p-5">
              Raza
            </th>

            <th class="text-left p-5">
              Sexo
            </th>

            <th class="text-left p-5">
              Acciones
            </th>

          </tr>

        </thead>



        <tbody>

          <tr
            v-for="vaca in filteredVacas"
            :key="vaca.id"
            class="border-b border-gray-100 hover:bg-gray-50"
          >

            <td class="p-5">
              {{ vaca.numero_arete }}
            </td>

            <td class="p-5 font-semibold">
              {{ vaca.nombre }}
            </td>

            <td class="p-5">
              {{ vaca.raza }}
            </td>

            <td class="p-5">
              {{ vaca.sexo }}
            </td>

            <td class="p-5">

              <div class="flex gap-2">

                <NuxtLink
                  :to="`/vacas/${vaca.id}`"
                  class="px-3 py-2 rounded-xl text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Ver
                </NuxtLink>



                <NuxtLink
                  :to="`/vacas/${vaca.id}/edit`"
                  class="px-3 py-2 rounded-xl text-sm bg-black text-white"
                >
                  Editar
                </NuxtLink>



                <button
                  @click="eliminarVaca(vaca.id)"
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