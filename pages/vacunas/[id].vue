<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const route = useRoute();

const { data: vacuna } =
  await useFetch(
    `/api/vacunas/${route.params.id}`
  );

const form = reactive({
  nombre: "",
  descripcion: ""
});

const errorMsg = ref("");

function extraerMensajeError(error: unknown) {
  const e = error as {
    data?: { statusMessage?: string; message?: string };
    statusMessage?: string;
    message?: string;
  };

  return (
    e?.data?.statusMessage ||
    e?.statusMessage ||
    e?.data?.message ||
    e?.message ||
    "No se pudo actualizar la vacuna."
  );
}

watchEffect(() => {

  if (!vacuna.value)
    return;

  form.nombre =
    vacuna.value.nombre ?? "";

  form.descripcion =
    vacuna.value.descripcion ?? "";

});

async function guardar() {

  try {

    await $fetch(
      `/api/vacunas/${route.params.id}`,
      {
        method: "PUT",

        body: {
          nombre: form.nombre,
          descripcion: form.descripcion
        }
      }
    );

    navigateTo(`/vacunas`);

  }

  catch (error) {

    console.error(error);

    errorMsg.value = extraerMensajeError(error);

  }

}

async function eliminar() {

  const ok =
    confirm(
      "¿Eliminar vacuna?"
    );

  if (!ok)
    return;

  try {

    await $fetch(
      `/api/vacunas/${route.params.id}`,
      {
        method: "DELETE"
      }
    );

    await navigateTo(
      "/vacunas"
    );

  }

  catch (error) {

    console.error(error);

    alert(
      "Error eliminando vacuna"
    );

  }

}
</script>

<template>

  <div
    v-if="vacuna"
    class="max-w-3xl"
  >

    <div
      class="flex items-center justify-between mb-8"
    >

      <div>

        <h1
          class="text-4xl font-bold"
        >
          {{ vacuna.nombre }}
        </h1>

        <p
          class="text-gray-500 mt-2"
        >
          Editar vacuna
        </p>

      </div>

      <button
        @click="eliminar"
        class="bg-red-600 text-white px-5 py-3 rounded-2xl"
      >
        Eliminar
      </button>

    </div>

    <div
      class="
        bg-white
        rounded-3xl
        border
        border-gray-100
        p-8
        space-y-6
      "
    >

      <p
        v-if="errorMsg"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ errorMsg }}
      </p>

      <input

        v-model="form.nombre"

        placeholder="Nombre"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "
      >

      <textarea

        v-model="form.descripcion"

        placeholder="Descripción"

        class="
          w-full
          h-40
          border
          border-gray-200
          rounded-2xl
          p-4
        "
      />

      <button

        @click="guardar"

        class="
          bg-black
          text-white
          px-6
          py-4
          rounded-2xl
        "
      >
        Guardar cambios
      </button>

    </div>

  </div>

</template>