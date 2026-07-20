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
const loading = ref(false);
const errorMessage = ref("");

async function guardar() {
  if (loading.value) return;
  if (!usuario.value?.id) {
    alert("Debes iniciar sesión.");
    return;
  }

  if (!form.peso || !form.fecha) {
    alert("Completa peso y fecha.");
    return;
  }

  errorMessage.value = "";
  loading.value = true;
  try {
    await $fetch("/api/pesos", {
      method: "POST",
      body: {
        bovino_id: vacaId,
        usuario_id: usuario.value.id,
        peso: form.peso,
        fecha: form.fecha,
      },
    });

    await navigateTo(`/bovinos/${vacaId}`);
  } catch (error: any) {
    console.error(error);
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo guardar el peso.";
  } finally {
    loading.value = false;
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

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <button
        @click="guardar"
        :disabled="loading"
        class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50"
      >
        {{ loading ? "Guardando..." : "Guardar peso" }}
      </button>
    </div>
  </div>
</template>
