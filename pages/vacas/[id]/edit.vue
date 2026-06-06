<script setup lang="ts">
const route = useRoute();
const vacaId = Number(route.params.id);

const { data: vaca } = await useFetch(`/api/vacas/${vacaId}`);

const form = reactive({
  numero_arete: "",
  nombre: "",
  raza: "",
  sexo: "",
  fecha_nacimiento: "",
  estado: "activa",
});

watchEffect(() => {
  if (vaca.value) {
    form.numero_arete = vaca.value.numero_arete ?? "";
    form.nombre = vaca.value.nombre ?? "";
    form.raza = vaca.value.raza ?? "";
    form.sexo = vaca.value.sexo ?? "";
    form.fecha_nacimiento = vaca.value.fecha_nacimiento ?? "";
    form.estado = vaca.value.estado ?? "activa";
  }
});

async function guardar() {
  await $fetch(`/api/vacas/${vacaId}`, {
    method: "PUT",
    body: form,
  });

  await navigateTo(`/vacas/${vacaId}`);
}
</script>

<template>
  <div v-if="vaca">
    <h1 class="text-4xl font-bold mb-8">Editar vaca</h1>

    <div class="space-y-4 max-w-xl">
      <input v-model="form.numero_arete" class="w-full border p-3 rounded-xl" placeholder="Número arete" />
      <input v-model="form.nombre" class="w-full border p-3 rounded-xl" placeholder="Nombre" />
      <input v-model="form.raza" class="w-full border p-3 rounded-xl" placeholder="Raza" />

      <select v-model="form.sexo" class="w-full border p-3 rounded-xl">
        <option value="">Sexo</option>
        <option value="Macho">Macho</option>
        <option value="Hembra">Hembra</option>
      </select>

      <input v-model="form.fecha_nacimiento" type="date" class="w-full border p-3 rounded-xl" />

      <select v-model="form.estado" class="w-full border p-3 rounded-xl">
        <option value="activa">activa</option>
        <option value="vendida">vendida</option>
        <option value="baja">baja</option>
      </select>

      <button @click="guardar" class="bg-black text-white px-6 py-3 rounded-2xl">
        Guardar cambios
      </button>
    </div>
  </div>
</template>