<script setup lang="ts">

definePageMeta({
  middleware: ["auth"]
});

const { data: logs } =
  await useFetch(
    "/api/observabilidad"
  );

</script>

<template>

  <div>

    <h1
      class="text-4xl font-bold mb-8"
    >
      Observabilidad IA
    </h1>

    <div
      class="bg-white rounded-3xl border border-gray-100 overflow-hidden"
    >

      <table
        class="w-full"
      >

        <thead
          class="bg-gray-50"
        >

          <tr>

            <th class="p-4 text-left">
              ID
            </th>

            <th class="p-4 text-left">
              Prompt
            </th>

            <th class="p-4 text-left">
              Bloqueado
            </th>

            <th class="p-4 text-left">
              Latencia
            </th>

            <th class="p-4 text-left">
              Fecha
            </th>

          </tr>

        </thead>

        <tbody>

          <tr
            v-for="log in logs"
            :key="log.id"
            class="border-t"
          >

            <td class="p-4">
              {{ log.id }}
            </td>

            <td class="p-4">
              {{ log.user_prompt }}
            </td>

            <td class="p-4">

              <span
                v-if="log.was_blocked"
                class="text-red-600 font-bold"
              >
                Sí
              </span>

              <span
                v-else
                class="text-green-600 font-bold"
              >
                No
              </span>

            </td>

            <td class="p-4">
              {{ log.total_latency_ms }} ms
            </td>

            <td class="p-4">
              {{ log.timestamp }}
            </td>

          </tr>

        </tbody>

      </table>

    </div>

  </div>

</template>