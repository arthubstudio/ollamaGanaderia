<script setup lang="ts">

definePageMeta({
  middleware: ["auth"]
});

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

const form = reactive({

  nombre: "",

  telefono: "",

  direccion: ""

});

const loading = ref(false);
const errorMessage = ref("");

async function crear() {

  if (loading.value) return;

  if (!usuario.value?.id) {

    alert(
      "Debes iniciar sesión."
    );

    return;

  }

  errorMessage.value = "";
  loading.value = true;

  try {
    await $fetch(
      "/api/duenos",
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
      "/duenos"
    );
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo crear el dueno.";
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
      Nuevo dueño
    </h1>

    <div
      class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl space-y-6"
    >

      <input
        v-model="form.nombre"
        placeholder="Nombre"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <input
        v-model="form.telefono"
        placeholder="Teléfono"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <textarea
        v-model="form.direccion"
        placeholder="Dirección"
        class="w-full border border-gray-200 rounded-2xl p-4 h-32"
      />

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
