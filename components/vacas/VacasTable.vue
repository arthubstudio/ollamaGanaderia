<script setup>

defineProps({

  vacas: {
    type: Array,
    required: true
  }

});

</script>



<template>

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
            Acción
          </th>

        </tr>

      </thead>



      <tbody>

        <tr
          v-for="vaca in vacas"
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

            <NuxtLink
              :to="`/bovinos/${vaca.id}`"
              class="bg-black text-white px-4 py-2 rounded-xl text-sm"
            >
              Ver
            </NuxtLink>

          </td>

        </tr>

      </tbody>

    </table>

  </div>

</template>