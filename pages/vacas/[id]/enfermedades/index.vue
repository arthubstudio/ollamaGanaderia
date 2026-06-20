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

async function guardar() {
  if (!usuario.value?.id) {
    alert("Debes iniciar sesión.");
    return;
  }

  if (!form.nombre || !form.tratamiento || !form.fecha || !form.veterinario) {
    alert("Completa todos los campos.");
    return;
  }

  try {
    await $fetch("/api/enfermedades", {
      method: "POST",
      body: {
        vaca_id: vacaId,
        usuario_id: usuario.value.id,
        nombre: form.nombre,
        tratamiento: form.tratamiento,
        fecha: form.fecha,
        veterinario: form.veterinario,
      },
    });

    await navigateTo(`/vacas/${vacaId}`);
  } catch (error) {
    console.error(error);
    alert("Error guardando enfermedad");
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

      <button
        @click="guardar"
        class="bg-black text-white px-6 py-3 rounded-2xl"
      >
        Guardar
      </button>
    </div>
  </div>
</template>