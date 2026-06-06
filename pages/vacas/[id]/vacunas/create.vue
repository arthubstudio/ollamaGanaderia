<script setup lang="ts">

const route = useRoute();

const vacaId =
  Number(route.params.id);



const { data: vacunas } =
  await useFetch(
    "/api/vacunas"
  );



const form = reactive({

  vacuna_id: "",

  fecha_aplicacion: "",

  veterinario: "",

  observaciones: ""

});



async function guardar() {

  try {

    await $fetch(

      "/api/vacunas-aplicadas",

      {

        method: "POST",

        body: {

          vaca_id: vacaId,

          vacuna_id:
            Number(form.vacuna_id),

          fecha_aplicacion:
            form.fecha_aplicacion,

          veterinario:
            form.veterinario,

          observaciones:
            form.observaciones

        }

      }

    );



    await navigateTo(
      `/vacas/${vacaId}`
    );

  }

  catch (error) {

    console.error(error);

    alert(
      "Error guardando vacuna"
    );

  }

}

</script>



<template>

  <div class="max-w-2xl">

    <div
      class="
        flex
        items-center
        justify-between
        mb-8
      "
    >

      <div>

        <h1
          class="text-4xl font-bold"
        >
          Aplicar vacuna
        </h1>

        <p
          class="text-gray-500 mt-2"
        >
          Registrar vacuna aplicada
          a la vaca.
        </p>

      </div>



      <NuxtLink

        to="/vacunas"

        class="
          bg-gray-100
          hover:bg-gray-200
          px-5
          py-3
          rounded-2xl
          font-semibold
        "

      >
        Administrar vacunas
      </NuxtLink>

    </div>



    <div
      class="
        bg-white
        rounded-3xl
        p-8
        border
        border-gray-100
        space-y-6
      "
    >

      <!-- SELECT VACUNAS -->

      <select

        v-model="form.vacuna_id"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "

      >

        <option value="">
          Selecciona vacuna
        </option>



        <option

          v-for="v in vacunas"

          :key="v.id"

          :value="v.id"

        >

          {{ v.nombre }}

        </option>

      </select>



      <!-- FECHA -->

      <input

        v-model="form.fecha_aplicacion"

        type="date"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "

      />



      <!-- VETERINARIO -->

      <input

        v-model="form.veterinario"

        placeholder="Veterinario"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "

      />



      <!-- OBSERVACIONES -->

      <textarea

        v-model="form.observaciones"

        placeholder="Observaciones"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "

      />



      <!-- BOTÓN -->

      <button

        @click="guardar"

        class="
          bg-black
          text-white
          px-6
          py-4
          rounded-2xl
        "

      >
        Guardar vacuna
      </button>

    </div>

  </div>

</template>