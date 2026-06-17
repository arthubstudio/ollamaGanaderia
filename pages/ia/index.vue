<script setup lang="ts">

definePageMeta({
  middleware: ["auth"]
})

const usuario =
  useState<any>(
    "usuario"
  );

const conversationId =
  ref<string | null>(
    null
  );

onMounted(async () => {

  if (!usuario.value?.id)
    return;

  const conv =
    await $fetch(

      `/api/conversations/by-user/${usuario.value.id}`

    );

  if (conv) {

    conversationId.value =
      conv.id;

  }

  else {

    const nueva =
      await $fetch(
        "/api/conversations/create",
        {
          method: "POST",
          body: {
            usuario_id:
              usuario.value.id
          }
        }
      );

    conversationId.value =
      nueva.conversation_id;

  }

});

const pregunta = ref("");

const respuesta = ref("");

const loading = ref(false);



async function enviar() {

  if (!pregunta.value)
    return;

  if (!usuario.value?.id) {
    respuesta.value = "No hay usuario autenticado.";
    return;
  }

  loading.value = true;

  respuesta.value = "";

  try {

    const response =
      await $fetch(
        "/api/ia/router",
        {

          method: "POST",

          body: {

            pregunta:
              pregunta.value,

            conversation_id:
              conversationId.value,

            usuario_id:
              usuario.value.id

          }

        }
      );

    respuesta.value =
      response.respuesta;

  }

  catch (error) {

    console.error(error);

    respuesta.value =
      "Error consultando IA.";

  }

  finally {

    loading.value = false;

  }

}

</script>

<template>

  <div
    class="max-w-4xl mx-auto"
  >

    <h1
      class="text-5xl font-bold mb-10"
    >
      IA Ganadera
    </h1>

    <!-- INPUT -->

    <div
      class="bg-white rounded-3xl p-8 border border-gray-100"
    >

      <textarea
        v-model="pregunta"
        placeholder="Pregunta algo..."
        class="w-full h-40 border border-gray-200 rounded-2xl p-4 outline-none"
      />

      <button
        @click="enviar"
        :disabled="loading"
        class="mt-6 bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50"
      >

        {{ loading
          ? "Pensando..."
          : "Preguntar IA"
        }}

      </button>

    </div>

    <!-- LOADING -->

    <div
      v-if="loading"
      class="flex items-center gap-3 mt-8 text-gray-500"
    >

      <div
        class="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin"
      />

      <span>
        Pensando respuesta...
      </span>

    </div>

    <!-- RESPUESTA -->

    <div
      v-if="respuesta && !loading"
      class="mt-8 bg-white rounded-3xl p-8 border border-gray-100 whitespace-pre-line"
    >

      {{ respuesta }}

    </div>

  </div>

</template>