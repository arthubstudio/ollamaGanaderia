<script setup lang="ts">
const route = useRoute();
const vacaId = Number(route.params.id);

const { data: duenos } = await useFetch("/api/duenos");
const { data: ranchos } = await useFetch("/api/ranchos");

const form = reactive({
  dueno_id: null as number | null,
  rancho_id: null as number | null,
  fecha_inicio: "",
  observaciones: "",
});

async function guardar() {
  await $fetch("/api/historial-propiedad", {
    method: "POST",
    body: {
      vaca_id: vacaId,
      dueno_id: form.dueno_id,
      rancho_id: form.rancho_id,
      fecha_inicio: form.fecha_inicio,
      observaciones: form.observaciones,
    },
  });

  await navigateTo(`/vacas/${vacaId}`);
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Transferir propiedad</h1>

    <div class="space-y-4 max-w-xl">
      <select v-model="form.dueno_id" class="w-full border p-3 rounded-xl">
        <option :value="null">Selecciona dueño</option>
        <option v-for="d in duenos" :key="d.id" :value="d.id">
          {{ d.nombre }}
        </option>
      </select>

      <select v-model="form.rancho_id" class="w-full border p-3 rounded-xl">
        <option :value="null">Selecciona rancho</option>
        <option v-for="r in ranchos" :key="r.id" :value="r.id">
          {{ r.nombre }}
        </option>
      </select>

      <input v-model="form.fecha_inicio" type="date" class="w-full border p-3 rounded-xl" />
      <textarea v-model="form.observaciones" class="w-full border p-3 rounded-xl" placeholder="Observaciones" />

      <button @click="guardar" class="bg-black text-white px-6 py-3 rounded-2xl">
        Guardar
      </button>
    </div>
  </div>
</template>