<script setup lang="ts">

definePageMeta({
  middleware: ["auth"]
});

const search = ref("");

const usuario =
  useState<any>(
    "usuario",
    () => null
  );


const { data: bovinos, refresh } =
  await useFetch(
    "/api/bovinos",
    {
      query: {
        usuario_id:
          usuario.value?.id
      }
    }
  );

const filteredBovinos = computed(() => {

  if (!bovinos.value) {
    return [];
  }

  return bovinos.value.filter(
    (bovino: any) => {

      return (

        bovino.nombre
          ?.toLowerCase()
          .includes(
            search.value.toLowerCase()
          )

        ||

        bovino.raza
          ?.toLowerCase()
          .includes(
            search.value.toLowerCase()
          )

        ||

        bovino.numero_arete
          ?.toLowerCase()
          .includes(
            search.value.toLowerCase()
          )

      );

    }
  );

});

async function eliminarBovino(
  id: number
) {

  const ok =
    confirm(
      "¿Eliminar este bovino?"
    );

  if (!ok) {
    return;
  }

  try {

    await $fetch(
      `/api/bovinos/${id}`,
      {
        method: "DELETE"
      }
    );

    await refresh();

  }

  catch (error) {

    console.error(error);

    alert(
      "No se pudo eliminar. Revisa registros relacionados."
    );

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
          Bovinos
        </h1>

        <p
          class="text-gray-500 mt-2"
        >
          Gestión de vacas, toros y ganado bovino.
        </p>

      </div>



      <NuxtLink
        to="/bovinos/create"
        class="bg-black text-white px-6 py-4 rounded-2xl font-semibold"
      >
        Nuevo bovino
      </NuxtLink>

    </div>



    <!-- SEARCH -->

    <div
      class="mb-6"
    >

      <input
        v-model="search"
        type="text"
        placeholder="Buscar bovino..."
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
            v-for="bovino in filteredBovinos"
            :key="bovino.id"
            class="border-b border-gray-100 hover:bg-gray-50"
          >

            <td class="p-5">
              {{ bovino.numero_arete }}
            </td>

            <td class="p-5 font-semibold">
              {{ bovino.nombre }}
            </td>

            <td class="p-5">
              {{ bovino.raza }}
            </td>

            <td class="p-5">
              {{ bovino.sexo }}
            </td>

            <td class="p-5">

              <div class="flex gap-2">

                <NuxtLink
                  :to="`/bovinos/${bovino.id}`"
                  class="px-3 py-2 rounded-xl text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Ver
                </NuxtLink>



                <NuxtLink
                  :to="`/bovinos/${bovino.id}/edit`"
                  class="px-3 py-2 rounded-xl text-sm bg-black text-white"
                >
                  Editar
                </NuxtLink>



                <button
                  @click="eliminarBovino(bovino.id)"
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