<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });

const filters = reactive({ search: "", type: "", active: "true", sort: "nombre" });
const editing = ref<any>(null);
const form = reactive({ nombre: "", nombre_cientifico: "", pais_origen: "", tipo: "doble_proposito", descripcion: "", activo: true });
const errorMessage = ref("");
const saving = ref(false);
const togglingId = ref<number | null>(null);
const usuario = useState<any>("usuario", () => null);

const { data, refresh, status } = await useFetch("/api/breeds", {
  query: computed(() => ({ ...filters, limit: 100 }))
});
const breeds = computed(() => data.value?.items ?? []);

function resetForm() {
  editing.value = null;
  Object.assign(form, { nombre: "", nombre_cientifico: "", pais_origen: "", tipo: "doble_proposito", descripcion: "", activo: true });
}

function editBreed(breed: any) {
  editing.value = breed;
  Object.assign(form, {
    nombre: breed.nombre ?? "",
    nombre_cientifico: breed.nombre_cientifico ?? "",
    pais_origen: breed.pais_origen ?? "",
    tipo: breed.tipo ?? "doble_proposito",
    descripcion: breed.descripcion ?? "",
    activo: Boolean(breed.activo)
  });
}

async function saveBreed() {
  if (saving.value) return;
  errorMessage.value = "";
  saving.value = true;
  try {
    if (editing.value) {
      await $fetch(`/api/breeds/${editing.value.id}`, { method: "PUT", body: form });
    } else {
      await $fetch("/api/breeds", { method: "POST", body: form });
    }
    resetForm();
    await refresh();
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo guardar la raza.";
  } finally {
    saving.value = false;
  }
}

async function toggleBreed(breed: any) {
  if (togglingId.value !== null) return;
  errorMessage.value = "";
  togglingId.value = Number(breed.id);
  try {
    await $fetch(`/api/breeds/${breed.id}`, { method: "PUT", body: { activo: !breed.activo } });
    await refresh();
  } catch (error: any) {
    errorMessage.value = error?.data?.data?.message ?? error?.data?.statusMessage ?? "No se pudo cambiar el estado de la raza.";
  } finally {
    togglingId.value = null;
  }
}

function canEdit(breed: any) {
  return usuario.value?.rol === "admin" || Number(breed.created_by) === Number(usuario.value?.id);
}
</script>

<template>
  <div>
    <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
      <div>
        <h1 class="text-4xl font-bold">Catalogo de Razas</h1>
        <p class="text-gray-500 mt-2">Razas globales y registros personalizados.</p>
      </div>
      <div class="grid sm:grid-cols-3 gap-3 xl:w-[640px]">
        <input v-model="filters.search" placeholder="Buscar raza..." class="border border-gray-200 rounded-xl p-3 bg-white" />
        <select v-model="filters.type" class="border border-gray-200 rounded-xl p-3 bg-white">
          <option value="">Todos los tipos</option>
          <option value="carne">Carne</option><option value="leche">Leche</option>
          <option value="doble_proposito">Doble proposito</option><option value="otro">Otro</option>
        </select>
        <select v-model="filters.active" class="border border-gray-200 rounded-xl p-3 bg-white">
          <option value="">Todas</option><option value="true">Activas</option><option value="false">Inactivas</option>
        </select>
      </div>
    </div>

    <div class="grid xl:grid-cols-[1fr_360px] gap-8">
      <div class="bg-white rounded-3xl border border-gray-100 overflow-x-auto">
        <table class="w-full min-w-[760px]">
          <thead class="bg-gray-50"><tr><th class="p-4 text-left">Raza</th><th class="p-4 text-left">Origen</th><th class="p-4 text-left">Tipo</th><th class="p-4 text-left">Estado</th><th class="p-4"></th></tr></thead>
          <tbody>
            <tr v-for="breed in breeds" :key="breed.id" class="border-t">
              <td class="p-4"><p class="font-semibold">{{ breed.nombre }}</p><p class="text-xs text-gray-500 line-clamp-1">{{ breed.descripcion }}</p></td>
              <td class="p-4">{{ breed.pais_origen || "-" }}</td>
              <td class="p-4 capitalize">{{ String(breed.tipo).replace("_", " ") }}</td>
              <td class="p-4"><span :class="breed.activo ? 'text-emerald-700' : 'text-gray-400'">{{ breed.activo ? "Activa" : "Inactiva" }}</span></td>
              <td class="p-4 text-right whitespace-nowrap" v-if="canEdit(breed)">
                <button class="px-3 py-2 text-sm bg-gray-100 rounded-xl mr-2" @click="editBreed(breed)">Editar</button>
                <button :disabled="togglingId !== null" class="px-3 py-2 text-sm rounded-xl disabled:opacity-50" :class="breed.activo ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'" @click="toggleBreed(breed)">
                  {{ togglingId === Number(breed.id) ? "Procesando..." : (breed.activo ? "Desactivar" : "Activar") }}
                </button>
              </td>
              <td v-else class="p-4 text-right text-xs text-gray-400">Solo lectura</td>
            </tr>
            <tr v-if="status === 'pending'"><td colspan="5" class="p-8 text-center text-gray-500">Cargando...</td></tr>
          </tbody>
        </table>
      </div>

      <form class="bg-white rounded-3xl border border-gray-100 p-6 h-fit space-y-4" @submit.prevent="saveBreed">
        <div class="flex items-center justify-between"><h2 class="text-xl font-bold">{{ editing ? "Editar raza" : "Nueva raza" }}</h2><button v-if="editing" type="button" class="text-sm text-gray-500" @click="resetForm">Cancelar</button></div>
        <input v-model="form.nombre" required placeholder="Nombre" class="w-full border rounded-xl p-3" />
        <input v-model="form.nombre_cientifico" placeholder="Nombre cientifico" class="w-full border rounded-xl p-3" />
        <input v-model="form.pais_origen" placeholder="Pais de origen" class="w-full border rounded-xl p-3" />
        <select v-model="form.tipo" class="w-full border rounded-xl p-3"><option value="carne">Carne</option><option value="leche">Leche</option><option value="doble_proposito">Doble proposito</option><option value="trabajo">Trabajo</option><option value="otro">Otro</option></select>
        <textarea v-model="form.descripcion" placeholder="Descripcion" class="w-full border rounded-xl p-3 h-24" />
        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
        <button :disabled="saving" class="w-full bg-black text-white p-3 rounded-xl font-semibold disabled:opacity-50">
          {{ saving ? "Guardando..." : (editing ? "Guardar cambios" : "Crear raza") }}
        </button>
      </form>
    </div>
  </div>
</template>
