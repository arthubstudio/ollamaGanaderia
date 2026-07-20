<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const usuario = useState<any>("usuario", () => null);

const route = useRoute();
const vacaId = Number(route.params.id);

const form = reactive({
  nombre: "",
  tratamiento: "",
  fecha: "",
  veterinario: "",
});
const loading = ref(false);
const errorMessage = ref("");

async function guardar() {
  if (loading.value) return;
  if (!usuario.value?.id) {
    alert("Debes iniciar sesión.");
    return;
  }

  if (!form.nombre || !form.tratamiento || !form.fecha || !form.veterinario) {
    alert("Completa todos los campos.");
    return;
  }

  errorMessage.value = "";
  loading.value = true;
  try {
    await $fetch("/api/enfermedades", {
      method: "POST",
      body: {
        bovino_id: vacaId,
        usuario_id: usuario.value.id,
        nombre: form.nombre,
        tratamiento: form.tratamiento,
        fecha: form.fecha,
        veterinario: form.veterinario,
      },
    });

    await navigateTo(`/bovinos/${vacaId}`);
  } catch (error: any) {
    console.error(error);
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo guardar la enfermedad.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Registrar enfermedad</h1>

    <div class="space-y-4 max-w-xl">
      <input
        v-model="form.nombre"
        class="w-full border p-3 rounded-xl"
        placeholder="Nombre de la enfermedad"
      />

      <textarea
        v-model="form.tratamiento"
        class="w-full border p-3 rounded-xl"
        placeholder="Tratamiento"
      />

      <input
        v-model="form.fecha"
        type="date"
        class="w-full border p-3 rounded-xl"
      />

      <input
        v-model="form.veterinario"
        class="w-full border p-3 rounded-xl"
        placeholder="Veterinario"
      />

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <button
        @click="guardar"
        :disabled="loading"
        class="bg-black text-white px-6 py-3 rounded-2xl disabled:opacity-50"
      >
        {{ loading ? "Guardando..." : "Guardar" }}
      </button>
    </div>
  </div>
</template>
