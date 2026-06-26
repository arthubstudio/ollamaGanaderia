<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const usuario = useState<any>("usuario", () => null);

const route = useRoute();
const vacaId = Number(route.params.id);

const { data: vacunas } = await useFetch("/api/vacunas", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const form = reactive({
  vacuna_id: "",
  fecha_aplicacion: "",
  veterinario: "",
  observaciones: ""
});

async function guardar() {
  if (!usuario.value?.id) {
    alert("Debes iniciar sesión.");
    return;
  }

  if (!form.vacuna_id || !form.fecha_aplicacion) {
    alert("Selecciona una vacuna y fecha.");
    return;
  }

  try {
    await $fetch("/api/vacunas-aplicadas", {
      method: "POST",
      body: {
        bovino_id: vacaId,
        usuario_id: usuario.value.id,
        vacuna_id: Number(form.vacuna_id),
        fecha_aplicacion: form.fecha_aplicacion,
        veterinario: form.veterinario,
        observaciones: form.observaciones
      }
    });

    await navigateTo(`/bovinos/${vacaId}`);
  } catch (error) {
    console.error(error);
    alert("Error guardando vacuna");
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold">Aplicar vacuna</h1>
        <p class="text-gray-500 mt-2">
          Registrar vacuna aplicada al bovino.
        </p>
      </div>

      <NuxtLink
        to="/vacunas"
        class="bg-gray-100 hover:bg-gray-200 px-5 py-3 rounded-2xl font-semibold"
      >
        Administrar vacunas
      </NuxtLink>
    </div>

    <div class="bg-white rounded-3xl p-8 border border-gray-100 space-y-6">
      <select
        v-model="form.vacuna_id"
        class="w-full border border-gray-200 rounded-2xl p-4"
      >
        <option value="">Selecciona vacuna</option>

        <option
          v-for="v in vacunas ?? []"
          :key="v.id"
          :value="v.id"
        >
          {{ v.nombre }}
        </option>
      </select>

      <input
        v-model="form.fecha_aplicacion"
        type="date"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <input
        v-model="form.veterinario"
        placeholder="Veterinario"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <textarea
        v-model="form.observaciones"
        placeholder="Observaciones"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <button
        @click="guardar"
        class="bg-black text-white px-6 py-4 rounded-2xl"
      >
        Guardar vacuna
      </button>
    </div>
  </div>
</template>