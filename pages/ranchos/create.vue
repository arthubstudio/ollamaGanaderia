<script setup lang="ts">

definePageMeta({
  middleware: ["auth"]
});

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

const { data: duenos } =
  await useFetch(
    "/api/duenos",
    {
      query: {
        usuario_id:
          usuario.value?.id
      }
    }
  );

const form = reactive({

  nombre: "",

  ubicacion: "",

  dueno_ids: [] as number[]

});
const loading = ref(false);
const errorMessage = ref("");

async function crear() {

  if (loading.value) return;
  errorMessage.value = "";

  if (!usuario.value?.id) {

    alert(
      "Debes iniciar sesión."
    );

    return;

  }

  try {
    loading.value = true;
    await $fetch(
      "/api/ranchos",
      {

      method: "POST",

      body: {

        ...form,

        usuario_id:
          usuario.value.id

      }

      }
    );

    await navigateTo(
      "/ranchos"
    );
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? "No se pudo crear el rancho.";
  } finally {
    loading.value = false;
  }

}

</script>

<template>

  <div>

    <h1
      class="text-4xl font-bold mb-8"
    >
      Nuevo rancho
    </h1>

    <div
      class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl space-y-6"
    >

      <input
        v-model="form.nombre"
        placeholder="Nombre"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <textarea
        v-model="form.ubicacion"
        placeholder="Ubicación"
        class="w-full border border-gray-200 rounded-2xl p-4 h-28"
      />

      <fieldset class="space-y-2">
        <legend class="font-semibold mb-2">Dueños del rancho</legend>
        <label v-for="d in duenos ?? []" :key="d.id" class="flex items-center gap-3">
          <input v-model="form.dueno_ids" type="checkbox" :value="Number(d.id)" />
          <span>{{ d.nombre }}</span>
        </label>
      </fieldset>

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <button
        @click="crear"
        :disabled="loading"
        class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50"
      >
        {{ loading ? "Guardando..." : "Guardar" }}
      </button>

    </div>

  </div>

</template>
