<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });

const route = useRoute();
const bovinoId = Number(route.params.id);
const { data: bovino } = await useFetch(`/api/bovinos/${bovinoId}`);
const { data: breedData } = await useFetch("/api/breeds", { query: { active: true, limit: 100 } });
const breeds = computed(() => breedData.value?.items ?? []);
const breedSearch = ref("");
const loading = ref(false);
const errorMessage = ref("");
const filteredBreeds = computed(() => {
  const query = breedSearch.value.toLowerCase().trim();
  return query ? breeds.value.filter((item: any) => String(item.nombre).toLowerCase().includes(query)) : breeds.value;
});

const form = reactive({
  numero_arete: "",
  nombre: "",
  breed_id: null as number | null,
  sexo: "",
  fecha_nacimiento: "",
  estado: "activa"
});

watchEffect(() => {
  if (!bovino.value) return;
  form.numero_arete = bovino.value.numero_arete ?? "";
  form.nombre = bovino.value.nombre ?? "";
  form.breed_id = bovino.value.breed_id ? Number(bovino.value.breed_id) : null;
  form.sexo = bovino.value.sexo ?? "";
  form.fecha_nacimiento = bovino.value.fecha_nacimiento ?? "";
  form.estado = bovino.value.estado ?? "activa";
});

async function guardar() {
  if (loading.value) return;
  const breed = breeds.value.find((item: any) => Number(item.id) === Number(form.breed_id));
  if (!breed) return alert("Selecciona una raza activa del catalogo.");
  errorMessage.value = "";
  loading.value = true;
  try {
    await $fetch(`/api/bovinos/${bovinoId}`, {
      method: "PUT",
      body: { ...form, raza: breed.nombre }
    });
    await navigateTo(`/bovinos/${bovinoId}`);
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo actualizar el bovino.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="bovino">
    <h1 class="text-4xl font-bold mb-8">Editar bovino</h1>
    <div class="space-y-4 max-w-xl bg-white border border-gray-100 rounded-3xl p-8">
      <label class="block">
        <span class="text-sm font-semibold text-gray-700">Arete</span>
        <input v-model="form.numero_arete" readonly class="mt-2 w-full border p-3 rounded-xl bg-gray-50 text-gray-500" />
      </label>
      <input v-model="form.nombre" class="w-full border p-3 rounded-xl" placeholder="Nombre" />
      <input v-model="breedSearch" class="w-full border p-3 rounded-xl" placeholder="Buscar raza..." />
      <select v-model="form.breed_id" class="w-full border p-3 rounded-xl">
        <option :value="null">Selecciona una raza</option>
        <option v-for="breed in filteredBreeds" :key="breed.id" :value="Number(breed.id)">{{ breed.nombre }}</option>
      </select>
      <select v-model="form.sexo" class="w-full border p-3 rounded-xl">
        <option value="">Sexo</option>
        <option value="Macho">Macho (toro)</option>
        <option value="Hembra">Hembra (vaca)</option>
      </select>
      <input v-model="form.fecha_nacimiento" type="date" class="w-full border p-3 rounded-xl" />
      <select v-model="form.estado" class="w-full border p-3 rounded-xl">
        <option value="activa">Activa</option>
        <option value="vendida">Vendida</option>
        <option value="baja">Baja</option>
      </select>
      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      <button @click="guardar" :disabled="loading" class="bg-black text-white px-6 py-3 rounded-2xl disabled:opacity-50">
        {{ loading ? "Guardando..." : "Guardar cambios" }}
      </button>
    </div>
  </div>
</template>
