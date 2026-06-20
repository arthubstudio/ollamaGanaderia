<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const usuario = useState<any>("usuario", () => null);

const route = useRoute();
const vacaId = Number(route.params.id);

const form = reactive({
  peso: "",
  fecha: "",
});

async function guardar() {
  if (!usuario.value?.id) {
    alert("Debes iniciar sesión.");
    return;
  }

  if (!form.peso || !form.fecha) {
    alert("Completa peso y fecha.");
    return;
  }

  try {
    await $fetch("/api/pesos", {
      method: "POST",
      body: {
        vaca_id: vacaId,
        usuario_id: usuario.value.id,
        peso: form.peso,
        fecha: form.fecha,
      },
    });

    await navigateTo(`/vacas/${vacaId}`);
  } catch (error) {
    console.error(error);
    alert("Error guardando peso");
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-4xl font-bold mb-8">Agregar Peso</h1>

    <div class="bg-white rounded-3xl p-8 border border-gray-100 space-y-6">
      <input
        v-model="form.peso"
        type="number"
        placeholder="Peso"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <input
        v-model="form.fecha"
        type="date"
        class="w-full border border-gray-200 rounded-2xl p-4"
      />

      <button
        @click="guardar"
        class="bg-black text-white px-6 py-4 rounded-2xl"
      >
        Guardar peso
      </button>
    </div>
  </div>
</template>