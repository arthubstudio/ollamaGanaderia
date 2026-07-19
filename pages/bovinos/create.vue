<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });

const form = reactive({
  nombre: "",
  breed_id: null as number | null,
  sexo: "",
  fecha_nacimiento: ""
});
const breedSearch = ref("");
const showBreedForm = ref(false);
const newBreed = reactive({ nombre: "", tipo: "doble_proposito" });
const loading = ref(false);
const errorMessage = ref("");

const { data: breedData, refresh: refreshBreeds } = await useFetch("/api/breeds", {
  query: { active: true, limit: 100 }
});

const breeds = computed(() => breedData.value?.items ?? []);
const filteredBreeds = computed(() => {
  const query = breedSearch.value.trim().toLowerCase();
  if (!query) return breeds.value;
  return breeds.value.filter((breed: any) =>
    String(breed.nombre).toLowerCase().includes(query) ||
    String(breed.pais_origen ?? "").toLowerCase().includes(query)
  );
});

async function createBreed() {
  if (!newBreed.nombre.trim()) return;
  const result: any = await $fetch("/api/breeds", {
    method: "POST",
    body: newBreed
  });
  await refreshBreeds();
  form.breed_id = Number(result.breed.id);
  breedSearch.value = String(result.breed.nombre);
  newBreed.nombre = "";
  showBreedForm.value = false;
}

async function crearBovino() {
  errorMessage.value = "";
  if (!form.nombre.trim() || !form.breed_id || !form.sexo) {
    errorMessage.value = "Completa nombre, raza y sexo.";
    return;
  }
  const breed = breeds.value.find((item: any) => Number(item.id) === Number(form.breed_id));
  if (!breed) {
    errorMessage.value = "Selecciona una raza activa del catalogo.";
    return;
  }

  try {
    loading.value = true;
    await $fetch("/api/bovinos", {
      method: "POST",
      body: { ...form, raza: breed.nombre }
    });
    await navigateTo("/bovinos");
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "Error al registrar el bovino.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-4xl font-bold">Nuevo bovino</h1>
      <p class="text-gray-500 mt-2">El arete se genera automaticamente al guardar.</p>
    </div>

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl">
      <div class="space-y-6">
        <label class="block">
          <span class="text-sm font-semibold text-gray-700">Nombre</span>
          <input v-model="form.nombre" placeholder="Nombre del bovino" class="mt-2 w-full border border-gray-200 rounded-2xl p-4" />
        </label>

        <div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm font-semibold text-gray-700">Raza</span>
            <button type="button" class="text-sm font-semibold text-emerald-700" @click="showBreedForm = !showBreedForm">
              {{ showBreedForm ? "Cancelar" : "Crear raza" }}
            </button>
          </div>
          <input v-model="breedSearch" placeholder="Buscar raza..." class="mt-2 w-full border border-gray-200 rounded-2xl p-4" />
          <select v-model="form.breed_id" class="mt-2 w-full border border-gray-200 rounded-2xl p-4">
            <option :value="null">Selecciona una raza</option>
            <option v-for="breed in filteredBreeds" :key="breed.id" :value="Number(breed.id)">
              {{ breed.nombre }}{{ breed.pais_origen ? ` - ${breed.pais_origen}` : "" }}
            </option>
          </select>
        </div>

        <div v-if="showBreedForm" class="grid sm:grid-cols-[1fr_180px_auto] gap-3 border-l-4 border-emerald-600 pl-4">
          <input v-model="newBreed.nombre" placeholder="Nueva raza" class="border border-gray-200 rounded-xl p-3" />
          <select v-model="newBreed.tipo" class="border border-gray-200 rounded-xl p-3">
            <option value="carne">Carne</option>
            <option value="leche">Leche</option>
            <option value="doble_proposito">Doble proposito</option>
            <option value="otro">Otro</option>
          </select>
          <button type="button" class="bg-emerald-700 text-white px-4 rounded-xl" @click="createBreed">Crear</button>
        </div>

        <select v-model="form.sexo" class="w-full border border-gray-200 rounded-2xl p-4">
          <option value="">Selecciona sexo</option>
          <option value="Macho">Macho (toro)</option>
          <option value="Hembra">Hembra (vaca)</option>
        </select>

        <input v-model="form.fecha_nacimiento" type="date" class="w-full border border-gray-200 rounded-2xl p-4" />
        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

        <button @click="crearBovino" :disabled="loading" class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50">
          {{ loading ? "Guardando..." : "Guardar bovino" }}
        </button>
      </div>
    </div>
  </div>
</template>
