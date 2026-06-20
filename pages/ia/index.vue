<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const usuario = useState<any>("usuario", () => null);
const conversationId = ref<string | null>(null);
const pregunta = ref("");
const respuesta = ref("");
const loading = ref(false);
const estado = ref("");
const errorMsg = ref("");
const abortController = ref<AbortController | null>(null);

onMounted(async () => {
  if (!usuario.value?.id) return;

  try {
    const conv = await $fetch(`/api/conversations/by-user/${usuario.value.id}`);

    if (conv) {
      conversationId.value = conv.id;
    } else {
      const nueva = await $fetch("/api/conversations/create", {
        method: "POST",
        body: {
          usuario_id: usuario.value.id
        }
      });

      conversationId.value = nueva.conversation_id;
    }
  } catch (error) {
    console.error(error);
    errorMsg.value = "No se pudo cargar la conversación.";
  }
});

async function enviar() {
  if (!pregunta.value.trim()) return;

  if (!usuario.value?.id) {
    respuesta.value = "No hay usuario autenticado.";
    return;
  }

  if (!conversationId.value) {
    respuesta.value = "Aún no se ha creado la conversación.";
    return;
  }

  loading.value = true;
  estado.value = "Pensando...";
  respuesta.value = "";
  errorMsg.value = "";

  abortController.value?.abort();
  const controller = new AbortController();
  abortController.value = controller;

  try {
    const response = await fetch("/api/ia/router", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pregunta: pregunta.value,
        conversation_id: conversationId.value,
        usuario_id: usuario.value.id,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("La respuesta no tiene stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");

      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);

        if (rawEvent) {
          const lines = rawEvent.split("\n");
          let eventName = "message";
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          const dataText = dataLines.join("\n");

          if (eventName === "end") {
            estado.value = "";
          } else if (dataText) {
            try {
              const parsed = JSON.parse(dataText);

              if (parsed?.token) {
                respuesta.value += parsed.token;
              }

              if (parsed?.estado) {
                estado.value = parsed.estado;
              }

              if (parsed?.respuesta && !parsed?.token) {
                respuesta.value += parsed.respuesta;
              }
            } catch {
              respuesta.value += dataText;
            }
          }
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    estado.value = "";
  } catch (error: any) {
    if (error?.name !== "AbortError") {
      console.error(error);
      errorMsg.value = "Error consultando IA.";
      respuesta.value = "";
      estado.value = "";
    }
  } finally {
    loading.value = false;
    abortController.value = null;
  }
}

function detenerStream() {
  abortController.value?.abort();
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-5xl font-bold mb-10">
      IA Ganadera
    </h1>

    <div class="bg-white rounded-3xl p-8 border border-gray-100">
      <textarea
        v-model="pregunta"
        placeholder="Pregunta algo..."
        class="w-full h-40 border border-gray-200 rounded-2xl p-4 outline-none"
      />

      <div class="flex gap-3 mt-6">
        <button
          @click="enviar"
          :disabled="loading"
          class="bg-black text-white px-6 py-4 rounded-2xl disabled:opacity-50"
        >
          {{ loading ? "Pensando..." : "Preguntar IA" }}
        </button>

        <button
          v-if="loading"
          @click="detenerStream"
          class="bg-gray-200 text-gray-900 px-6 py-4 rounded-2xl"
        >
          Detener
        </button>
      </div>
    </div>

    <div
      v-if="estado"
      class="flex items-center gap-3 mt-8 text-gray-500"
    >
      <div class="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      <span>{{ estado }}</span>
    </div>

    <div
      v-if="errorMsg"
      class="mt-6 bg-red-50 text-red-700 border border-red-200 rounded-2xl p-4"
    >
      {{ errorMsg }}
    </div>

    <div
      v-if="respuesta"
      class="mt-8 bg-white rounded-3xl p-8 border border-gray-100 whitespace-pre-line"
    >
      {{ respuesta }}
    </div>
  </div>
</template>