<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const form = reactive({
  nombre: "",
  descripcion: ""
});

const usuario = useState<any>("usuario", () => null);
const guardando = ref(false);
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
    "No se pudo guardar la vacuna."
  );
}

async function guardar() {
  errorMsg.value = "";

  if (!form.nombre.trim()) {
    errorMsg.value = "El nombre de la vacuna es obligatorio.";
    return;
  }

  if (!usuario.value?.id) {
    errorMsg.value = "Sesión no disponible. Vuelve a iniciar sesión.";
    return;
  }

  guardando.value = true;

  try {
    await $fetch("/api/vacunas", {
      method: "POST",
      body: {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        usuario_id: usuario.value.id
      }
    });

    await navigateTo("/vacunas");
  } catch (error) {
    errorMsg.value = extraerMensajeError(error);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-4xl font-bold mb-8">Nueva vacuna</h1>

    <div class="bg-white rounded-3xl p-8 border border-gray-100 space-y-6">
      <p
        v-if="errorMsg"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ errorMsg }}
      </p>

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
        :disabled="guardando"
        class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-60"
        @click="guardar"
      >
        {{ guardando ? "Guardando..." : "Guardar vacuna" }}
      </button>
    </div>
  </div>
</template>
