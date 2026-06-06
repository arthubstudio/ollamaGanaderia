<script setup lang="ts">

const route = useRoute();

const vacaId =
  Number(route.params.id);



const { data: pesos } =
  await useFetch(
    `/api/pesos?vaca_id=${vacaId}`
  );



const ultimoPeso =
  computed(() =>
    pesos.value?.[0]
  );



const form = reactive({

  peso:
    ultimoPeso.value?.peso ?? "",

  fecha:
    ultimoPeso.value?.fecha
      ?.split("T")[0] ?? ""

});



async function guardar() {

  if (!ultimoPeso.value)
    return;



  await $fetch(

    `/api/pesos/${ultimoPeso.value.id}`,

    {

      method: "PUT",

      body: {

        peso: form.peso,

        fecha: form.fecha

      }

    }

  );



  await navigateTo(
    `/vacas/${vacaId}`
  );

}

</script>



<template>

  <div class="max-w-2xl">

    <h1
      class="text-4xl font-bold mb-8"
    >
      Actualizar Peso
    </h1>



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

      <input

        v-model="form.peso"

        type="number"

        placeholder="Peso"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "

      />



      <input

        v-model="form.fecha"

        type="date"

        class="
          w-full
          border
          border-gray-200
          rounded-2xl
          p-4
        "

      />



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
        Guardar cambios
      </button>

    </div>

  </div>

</template>