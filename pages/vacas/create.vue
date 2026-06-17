<script setup>

const usuario =
  useState(
    "usuario",
    () => null
  );

const form = reactive({

  numero_arete: "",

  nombre: "",

  raza: "",

  sexo: "",

  fecha_nacimiento: ""

});

const loading =
  ref(false);

async function crearVaca() {

  if (!usuario.value?.id) {

    alert(
      "Debes iniciar sesión."
    );

    return;

  }

  if (
    !form.numero_arete ||
    !form.nombre ||
    !form.raza ||
    !form.sexo
  ) {

    alert(
      "Completa todos los campos."
    );

    return;

  }

  try {

    loading.value =
      true;

    await $fetch(
      "/api/vacas",
      {

        method: "POST",

        body: {

          ...form,

          usuario_id:
            usuario.value.id

        }

      }
    );

    await navigateTo(
      "/vacas"
    );

  }

  catch (error) {

    console.error(error);

    alert(
      "Error al crear la vaca."
    );

  }

  finally {

    loading.value =
      false;

  }

}

</script>

<template>

  <div>

    <div
      class="mb-8"
    >

      <h1
        class="text-4xl font-bold"
      >
        Nueva Vaca
      </h1>

    </div>

    <div
      class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl"
    >

      <div
        class="space-y-6"
      >

        <input
          v-model="form.numero_arete"
          placeholder="Número arete"
          class="w-full border border-gray-200 rounded-2xl p-4"
        />

        <input
          v-model="form.nombre"
          placeholder="Nombre"
          class="w-full border border-gray-200 rounded-2xl p-4"
        />

        <input
          v-model="form.raza"
          placeholder="Raza"
          class="w-full border border-gray-200 rounded-2xl p-4"
        />

        <select
          v-model="form.sexo"
          class="w-full border border-gray-200 rounded-2xl p-4"
        >

          <option value="">
            Selecciona sexo
          </option>

          <option value="Macho">
            Macho
          </option>

          <option value="Hembra">
            Hembra
          </option>

        </select>

        <input
          v-model="form.fecha_nacimiento"
          type="date"
          class="w-full border border-gray-200 rounded-2xl p-4"
        />

        <button
          @click="crearVaca"
          :disabled="loading"
          class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50"
        >

          {{ loading
            ? "Guardando..."
            : "Guardar Vaca"
          }}

        </button>

      </div>

    </div>

  </div>

</template>