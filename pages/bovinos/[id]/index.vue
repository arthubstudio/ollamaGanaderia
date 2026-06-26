<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const route = useRoute();
const vacaId = Number(route.params.id);

const usuario = useState<any>("usuario", () => null);

const { data: vaca } = await useFetch(`/api/bovinos/${vacaId}`, {
  query: {
    usuario_id: usuario.value?.id
  }
});

const { data: pesos } = await useFetch("/api/pesos", {
  query: {
    bovino_id: vacaId,
    usuario_id: usuario.value?.id
  }
});

const { data: vacunasAplicadas } = await useFetch("/api/vacunas-aplicadas", {
  query: {
    bovino_id: vacaId,
    usuario_id: usuario.value?.id
  }
});

const { data: vacunas } = await useFetch("/api/vacunas", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const { data: enfermedades } = await useFetch("/api/enfermedades", {
  query: {
    bovino_id: vacaId,
    usuario_id: usuario.value?.id
  }
});

const { data: historial } = await useFetch("/api/historial-propiedad", {
  query: {
    bovino_id: vacaId,
    usuario_id: usuario.value?.id
  }
});

const { data: duenos } = await useFetch("/api/duenos", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const { data: ranchos } = await useFetch("/api/ranchos", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const pesosVaca = computed(() =>
  (pesos.value ?? []).filter((p: any) => p.bovino_id == vacaId)
);

const vacunasVaca = computed(() =>
  (vacunasAplicadas.value ?? []).filter((v: any) => v.bovino_id == vacaId)
);

const enfermedadesVaca = computed(() =>
  (enfermedades.value ?? []).filter((e: any) => e.bovino_id == vacaId)
);

const tienePeso = computed(() => (pesos.value?.length ?? 0) > 0);

const propiedadActual = computed(() => {
  const lista = historial.value ?? [];
  return lista.find((h: any) => h.bovino_id == vacaId && h.fecha_fin == null) ?? null;
});

const duenoActual = computed(() => {
  if (!propiedadActual.value) return null;
  return (duenos.value ?? []).find((d: any) => d.id == propiedadActual.value.dueno_id) ?? null;
});

const ranchoActual = computed(() => {
  if (!propiedadActual.value) return null;
  return (ranchos.value ?? []).find((r: any) => r.id == propiedadActual.value.rancho_id) ?? null;
});

const vacunaNombre = (id: number) => {
  const item = (vacunas.value ?? []).find((v: any) => Number(v.id) === Number(id));
  return item?.nombre ?? `Vacuna ${id}`;
};

async function eliminarVaca() {
  const ok = confirm("¿Eliminar este bovino?");
  if (!ok) return;

  await $fetch(`/api/bovinos/${vacaId}`, {
    method: "DELETE",
    query: {
      usuario_id: usuario.value?.id
    }
  });

  await navigateTo("/bovinos");
}

const pregunta = ref("");
const respuesta = ref("");

async function preguntarIA() {
  const data = await $fetch("/api/ia/router", {
    method: "POST",
    body: {
      pregunta: `
Información del bovino ${vaca.value?.nombre ?? ""}

${pregunta.value}
`,
      conversation_id: null,
      usuario_id: usuario.value?.id
    },
  });

  respuesta.value = data.respuesta;
}
</script>

<template>
  <div v-if="vaca">
    <div class="flex items-start justify-between mb-10">
      <div>
        <h1 class="text-5xl font-bold">{{ vaca.nombre }}</h1>
        <p class="text-gray-500 mt-2 text-lg">{{ vaca.raza }}</p>
      </div>

      <div class="flex gap-3">
        <NuxtLink
          :to="`/bovinos/${vaca.id}/edit`"
          class="bg-black text-white px-6 py-3 rounded-2xl font-semibold"
        >
          Editar bovino
        </NuxtLink>

        <button
          @click="eliminarVaca"
          class="bg-red-600 text-white px-6 py-3 rounded-2xl font-semibold"
        >
          Eliminar
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Arete</p>
        <h2 class="text-2xl font-bold mt-2">{{ vaca.numero_arete }}</h2>
      </div>

      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Sexo</p>
        <h2 class="text-2xl font-bold mt-2">{{ vaca.sexo }}</h2>
      </div>

      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Dueño</p>
        <h2 class="text-2xl font-bold mt-2">
          {{ duenoActual?.nombre || "Sin dueño" }}
        </h2>
      </div>

      <div class="bg-white rounded-3xl p-6 border border-gray-100">
        <p class="text-gray-500">Rancho</p>
        <h2 class="text-2xl font-bold mt-2">
          {{ ranchoActual?.nombre || "Sin rancho" }}
        </h2>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 mb-10">
      <NuxtLink
        :to="tienePeso ? `/bovinos/${vaca.id}/pesos/edit` : `/bovinos/${vaca.id}/pesos/create`"
        class="bg-black text-white px-5 py-3 rounded-2xl"
      >
        {{ tienePeso ? "Actualizar Peso" : "Agregar Peso" }}
      </NuxtLink>

      <NuxtLink
        :to="`/bovinos/${vaca.id}/vacunas/create`"
        class="bg-black text-white px-5 py-3 rounded-2xl"
      >
        Aplicar vacuna
      </NuxtLink>

      <NuxtLink
        :to="`/bovinos/${vaca.id}/enfermedades/create`"
        class="bg-black text-white px-5 py-3 rounded-2xl"
      >
        Registrar enfermedad
      </NuxtLink>

      <NuxtLink
        :to="`/bovinos/${vaca.id}/transferir`"
        class="bg-black text-white px-5 py-3 rounded-2xl"
      >
        Transferir propiedad
      </NuxtLink>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="bg-white rounded-3xl p-8 border border-gray-100">
        <h2 class="text-3xl font-bold mb-6">Peso</h2>
        <div class="space-y-4">
          <div
            v-for="peso in pesosVaca"
            :key="peso.id"
            class="border border-gray-100 rounded-2xl p-4"
          >
            <p class="font-semibold">{{ peso.peso }} kg</p>
            <p class="text-gray-500 text-sm">{{ peso.fecha }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-8 border border-gray-100">
        <h2 class="text-3xl font-bold mb-6">Vacunas</h2>
        <div class="space-y-4">
          <div
            v-for="v in vacunasVaca"
            :key="v.id"
            class="border border-gray-100 rounded-2xl p-4"
          >
            <p class="font-semibold">
              {{ v.vacuna_nombre || vacunaNombre(v.vacuna_id) }}
            </p>
            <p class="text-gray-500 text-sm">{{ v.fecha_aplicacion }}</p>
            <p class="text-gray-500 text-sm">{{ v.veterinario }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-8 border border-gray-100">
        <h2 class="text-3xl font-bold mb-6">Enfermedades</h2>
        <div class="space-y-4">
          <div
            v-for="e in enfermedadesVaca"
            :key="e.id"
            class="border border-gray-100 rounded-2xl p-4"
          >
            <p class="font-semibold">{{ e.nombre }}</p>
            <p class="text-gray-500 text-sm">{{ e.fecha }}</p>
            <p class="text-gray-500 text-sm">{{ e.veterinario }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-10 bg-white rounded-3xl p-8 border border-gray-100">
      <h2 class="text-3xl font-bold mb-6">IA Ganadera</h2>

      <textarea
        v-model="pregunta"
        placeholder="Pregunta algo sobre este bovino..."
        class="w-full h-32 border border-gray-200 rounded-2xl p-4 outline-none"
      />

      <button
        @click="preguntarIA"
        class="mt-4 bg-black text-white px-6 py-4 rounded-2xl"
      >
        Preguntar IA
      </button>

      <div v-if="respuesta" class="mt-8 bg-gray-50 rounded-2xl p-6 whitespace-pre-line">
        {{ respuesta }}
      </div>
    </div>
  </div>
</template>