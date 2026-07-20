<script setup lang="ts">
const route = useRoute();
const vacaId = Number(route.params.id);

const usuario = useState<any>("usuario", () => null);

const { data: duenos } = await useFetch("/api/duenos", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const { data: ranchos } = await useFetch("/api/ranchos", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const form = reactive({
  dueno_ids: [] as number[],
  rancho_id: null as number | null,
  fecha_inicio: "",
  observaciones: "",
});
const loading = ref(false);
const errorMessage = ref("");

async function guardar() {

  if (loading.value) return;
  errorMessage.value = "";
  loading.value = true;

  try {
    await $fetch(
      "/api/historial-propiedad",
      {
      method: "POST",

      body: {

        bovino_id:
          vacaId,

        dueno_ids:
          form.dueno_ids,

        rancho_id:
          form.rancho_id,

        fecha_inicio:
          form.fecha_inicio,

        observaciones:
          form.observaciones,

        usuario_id:
          usuario.value?.id

      }
      }
    );

    await navigateTo(`/bovinos/${vacaId}`);
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo actualizar la propiedad.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Transferir propiedad</h1>

    <div class="space-y-4 max-w-xl">
      <fieldset class="border p-3 rounded-xl space-y-2">
        <legend class="px-1 text-sm font-semibold">Propietarios</legend>
        <label v-for="d in duenos" :key="d.id" class="flex items-center gap-2">
          <input v-model="form.dueno_ids" type="checkbox" :value="Number(d.id)">
          <span>{{ d.nombre }}</span>
        </label>
      </fieldset>

      <select v-model="form.rancho_id" class="w-full border p-3 rounded-xl">
        <option :value="null">Selecciona rancho</option>
        <option v-for="r in ranchos" :key="r.id" :value="r.id">
          {{ r.nombre }}
        </option>
      </select>

      <input v-model="form.fecha_inicio" type="date" class="w-full border p-3 rounded-xl" />
      <textarea v-model="form.observaciones" class="w-full border p-3 rounded-xl" placeholder="Observaciones" />

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <button @click="guardar" :disabled="loading" class="bg-black text-white px-6 py-3 rounded-2xl disabled:opacity-50">
        {{ loading ? "Guardando..." : "Guardar" }}
      </button>
    </div>
  </div>
</template>
