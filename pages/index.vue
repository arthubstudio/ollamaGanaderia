<script setup lang="ts">

definePageMeta({
  middleware: ["auth"]
});

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

const { data } =
  await useFetch(
    "/api/dashboard",
    {
      query: {
        usuario_id:
          usuario.value?.id
      }
    }
  );

</script>

<template>

  <div
    class="space-y-10"
  >

    <!-- HEADER -->

    <div>

      <h1
        class="text-5xl font-bold"
      >
        Dashboard Ganadero
      </h1>

      <p
        class="text-gray-500 mt-3 text-lg"
      >
        Bienvenido al sistema inteligente de ganadería de engorda.
      </p>

    </div>

    <!-- STATS -->

    <div
      class="grid grid-cols-1 md:grid-cols-3 gap-6"
    >

      <div
        class="bg-white rounded-3xl p-8 border border-gray-100"
      >

        <div
          class="text-gray-500 text-sm"
        >
          Total Vacas
        </div>

        <div
          class="text-5xl font-bold mt-4"
        >
          {{ data?.totalVacas ?? 0 }}
        </div>

      </div>

      <div
        class="bg-white rounded-3xl p-8 border border-gray-100"
      >

        <div
          class="text-gray-500 text-sm"
        >
          Vacunas Aplicadas
        </div>

        <div
          class="text-5xl font-bold mt-4"
        >
          {{ data?.vacunasAplicadas ?? 0 }}
        </div>

      </div>

      <div
        class="bg-white rounded-3xl p-8 border border-gray-100"
      >

        <div
          class="text-gray-500 text-sm"
        >
          Peso Promedio
        </div>

        <div
          class="text-5xl font-bold mt-4"
        >
          {{ data?.pesoPromedio ?? 0 }} kg
        </div>

      </div>

    </div>

    <!-- ATAJOS -->

    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    >

      <NuxtLink
        to="/vacas"
        class="bg-white rounded-3xl p-8 border border-gray-100 hover:border-black transition"
      >

        <div
          class="text-2xl font-bold"
        >
          Vacas
        </div>

        <div
          class="text-gray-500 mt-2"
        >
          Gestionar ganado
        </div>

      </NuxtLink>

      <NuxtLink
        to="/duenos"
        class="bg-white rounded-3xl p-8 border border-gray-100 hover:border-black transition"
      >

        <div
          class="text-2xl font-bold"
        >
          Dueños
        </div>

        <div
          class="text-gray-500 mt-2"
        >
          Administrar propietarios
        </div>

      </NuxtLink>

      <NuxtLink
        to="/ranchos"
        class="bg-white rounded-3xl p-8 border border-gray-100 hover:border-black transition"
      >

        <div
          class="text-2xl font-bold"
        >
          Ranchos
        </div>

        <div
          class="text-gray-500 mt-2"
        >
          Gestionar ranchos
        </div>

      </NuxtLink>

      <NuxtLink
        to="/ia"
        class="bg-white rounded-3xl p-8 border border-gray-100 hover:border-black transition"
      >

        <div
          class="text-2xl font-bold"
        >
          IA Ganadera
        </div>

        <div
          class="text-gray-500 mt-2"
        >
          Consultas inteligentes
        </div>

      </NuxtLink>

    </div>

    <!-- RESUMEN -->

    <div
      class="bg-white rounded-3xl p-8 border border-gray-100"
    >

      <h2
        class="text-3xl font-bold mb-6"
      >
        Resumen del Sistema
      </h2>

      <div
        class="space-y-3 text-lg"
      >

        <div>
          🐄 Vacas registradas:
          <strong>
            {{ data?.totalVacas ?? 0 }}
          </strong>
        </div>

        <div>
          💉 Vacunas aplicadas:
          <strong>
            {{ data?.vacunasAplicadas ?? 0 }}
          </strong>
        </div>

        <div>
          ⚖️ Peso promedio:
          <strong>
            {{ data?.pesoPromedio ?? 0 }} kg
          </strong>
        </div>

      </div>

    </div>

  </div>

</template>