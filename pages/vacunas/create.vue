<script setup lang="ts">
const form = reactive({
  nombre: "",
  descripcion: "",
})

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

async function guardar() {

  await $fetch(
    "/api/vacunas",
    {
      method: "POST",

      body: {

        nombre:
          form.nombre,

        descripcion:
          form.descripcion,

        usuario_id:
          usuario.value?.id

      }

    }
  );

  await navigateTo("/vacunas");
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-4xl font-bold mb-8">Nueva vacuna</h1>

    <div class="bg-white rounded-3xl p-8 border border-gray-100 space-y-6">
      <input
        v-model="form.nombre"
        placeholder="Nombre"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <textarea
        v-model="form.descripcion"
        placeholder="Descripción"
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