<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocked?: boolean;
};

const usuario = useState<any>("usuario", () => null);
const conversationId = ref<string | null>(null);
const pregunta = ref("");
const mensajes = ref<ChatMessage[]>([]);
const loading = ref(false);
const estado = ref("");
const errorMsg = ref("");
const abortController = ref<AbortController | null>(null);
const escuchando = ref(false);
const vozDisponible = ref(false);
const vozError = ref("");

const chatContainer = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

const sugerencias = [
  { label: "Mis vacas", prompt: "¿Qué vacas tengo registradas?" },
  { label: "Conteo", prompt: "¿Cuántas vacas tengo?" },
  { label: "Memoria", prompt: "¿Qué recuerdas de mí?" },
  { label: "Ayuda", prompt: "¿En qué me puedes ayudar?" }
];

let recognition: any = null;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tipoEstado(estadoActual: string) {
  const texto = estadoActual.toLowerCase();
  if (texto.includes("bloqueada") || texto.includes("seguridad")) return "bloqueado";
  if (texto.includes("buscando") || texto.includes("recuperando") || texto.includes("consultando")) return "buscar";
  if (texto.includes("ejecutando") || texto.includes("guardando")) return "accion";
  if (texto.includes("recibiendo")) return "stream";
  return "pensando";
}

function scrollAlFinal() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

watch([mensajes, estado, loading], scrollAlFinal, { deep: true });

function iniciarReconocimientoVoz() {
  if (!process.client) return;

  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    vozDisponible.value = false;
    return;
  }

  vozDisponible.value = true;
  recognition = new SpeechRecognition();
  recognition.lang = "es-MX";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    escuchando.value = true;
    vozError.value = "";
  };

  recognition.onend = () => {
    escuchando.value = false;
  };

  recognition.onerror = () => {
    escuchando.value = false;
    vozError.value = "No se pudo capturar el audio.";
  };

  recognition.onresult = (event: any) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    pregunta.value = transcript.trim();
  };
}

function toggleVoz() {
  if (!recognition) iniciarReconocimientoVoz();
  if (!recognition || !vozDisponible.value) {
    vozError.value = "Tu navegador no soporta reconocimiento de voz.";
    return;
  }
  if (escuchando.value) {
    recognition.stop();
    return;
  }
  vozError.value = "";
  recognition.start();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    enviar();
  }
}

onMounted(async () => {
  iniciarReconocimientoVoz();
  inputRef.value?.focus();

  if (!usuario.value?.id) return;

  try {
    const conv = await $fetch(`/api/conversations/by-user/${usuario.value.id}`);
    if (conv) {
      conversationId.value = conv.id;
      const historial = await $fetch<Array<{ role: string; content: string }>>(
        `/api/conversations/${conv.id}/messages`
      );
      mensajes.value = historial.map((m) => ({
        id: uid(),
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content ?? ""
      }));
    } else {
      const nueva = await $fetch("/api/conversations/create", {
        method: "POST",
        body: { usuario_id: usuario.value.id }
      });
      conversationId.value = nueva.conversation_id;
    }
  } catch {
    errorMsg.value = "No se pudo cargar la conversación.";
  }
});

async function enviar(texto?: string) {
  const contenido = (texto ?? pregunta.value).trim();
  if (!contenido || loading.value) return;

  if (!usuario.value?.id || !conversationId.value) {
    errorMsg.value = "Sesión no disponible. Recarga la página.";
    return;
  }

  mensajes.value.push({
    id: uid(),
    role: "user",
    content: contenido
  });

  pregunta.value = "";
  loading.value = true;
  estado.value = "Pensando...";
  errorMsg.value = "";

  const assistantId = uid();
  mensajes.value.push({
    id: assistantId,
    role: "assistant",
    content: ""
  });

  abortController.value?.abort();
  const controller = new AbortController();
  abortController.value = controller;

  let bloqueado = false;

  try {
    const response = await fetch("/api/ia/router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pregunta: contenido,
        conversation_id: conversationId.value,
        usuario_id: usuario.value.id,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    if (!response.body) throw new Error("Sin stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const assistant = mensajes.value.find((m) => m.id === assistantId);

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
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }

          const dataText = dataLines.join("\n");

          if (eventName === "end") {
            estado.value = "";
          } else if (dataText && assistant) {
            try {
              const parsed = JSON.parse(dataText);
              if (parsed?.token) assistant.content += parsed.token;
              if (parsed?.estado) {
                estado.value = parsed.estado;
                if (parsed.estado.toLowerCase().includes("bloqueada")) {
                  bloqueado = true;
                  assistant.blocked = true;
                }
              }
              if (parsed?.respuesta && !parsed?.token) assistant.content += parsed.respuesta;
            } catch {
              assistant.content += dataText;
            }
          }
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    if (assistant?.content.includes("Solicitud bloqueada por seguridad")) {
      assistant.blocked = true;
    }
  } catch (error: any) {
    const assistant = mensajes.value.find((m) => m.id === assistantId);
    if (error?.name !== "AbortError") {
      if (assistant) assistant.content = "No pude procesar tu consulta. Intenta de nuevo.";
      errorMsg.value = "Error consultando IA.";
    } else if (assistant && !assistant.content) {
      mensajes.value = mensajes.value.filter((m) => m.id !== assistantId);
    }
  } finally {
    loading.value = false;
    estado.value = "";
    abortController.value = null;
    inputRef.value?.focus();
  }
}

function usarSugerencia(prompt: string) {
  enviar(prompt);
}

function detenerStream() {
  abortController.value?.abort();
}
</script>

<template>
  <div class="max-w-4xl mx-auto h-[calc(100vh-7rem)] lg:h-[calc(100vh-8.5rem)] flex flex-col">
    <div class="shrink-0 mb-4">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-900/10">
          <Icon name="lucide:sparkles" class="size-5" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-stone-900">
            Asistente Ganadero
          </h1>
          <p class="text-sm text-stone-500">
            Pregunta sobre vacas, vacunas, pesos y más
          </p>
        </div>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <div
        ref="chatContainer"
        class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth"
      >
        <div
          v-if="!mensajes.length"
          class="h-full flex flex-col items-center justify-center text-center px-4 py-8"
        >
          <div class="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center mb-4">
            <Icon name="mdi:cow" class="size-9 text-emerald-700" />
          </div>
          <h2 class="text-lg font-semibold text-stone-800">
            ¿En qué te ayudo hoy?
          </h2>
          <p class="text-stone-500 text-sm mt-2 max-w-sm">
            Escribe, usa voz o elige una sugerencia para empezar.
          </p>
          <div class="flex flex-wrap justify-center gap-2 mt-6">
            <button
              v-for="item in sugerencias"
              :key="item.label"
              @click="usarSugerencia(item.prompt)"
              class="px-4 py-2 rounded-full bg-stone-100 text-stone-700 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-800 transition"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <template v-else>
          <div
            v-for="msg in mensajes"
            :key="msg.id"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              v-if="msg.role === 'assistant'"
              class="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-600 text-white flex items-center justify-center text-sm shrink-0 mr-3 mt-1"
            >
              IA
            </div>

            <div
              class="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line"
              :class="msg.role === 'user'
                ? 'bg-emerald-600 text-white rounded-br-md shadow-sm'
                : msg.blocked
                  ? 'bg-red-50 text-red-800 border border-red-100 rounded-bl-md'
                  : 'bg-stone-100 text-stone-800 rounded-bl-md'"
            >
              <span v-if="msg.content">{{ msg.content }}</span>
              <span
                v-else-if="loading && msg.role === 'assistant'"
                class="inline-flex items-center gap-1.5 text-stone-400"
              >
                <span class="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                <span class="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                <span class="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>

            <div
              v-if="msg.role === 'user'"
              class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shrink-0 ml-3 mt-1"
            >
              {{ usuario?.nombre?.charAt(0) ?? "T" }}
            </div>
          </div>
        </template>

        <div
          v-if="estado && mensajes.length"
          class="flex justify-start pl-11"
        >
          <div
            class="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border"
            :class="{
              'bg-blue-50 border-blue-100 text-blue-700': tipoEstado(estado) === 'pensando',
              'bg-amber-50 border-amber-100 text-amber-700': tipoEstado(estado) === 'buscar',
              'bg-purple-50 border-purple-100 text-purple-700': tipoEstado(estado) === 'accion',
              'bg-emerald-50 border-emerald-100 text-emerald-700': tipoEstado(estado) === 'stream',
              'bg-red-50 border-red-100 text-red-700': tipoEstado(estado) === 'bloqueado'
            }"
          >
            <span
              v-if="tipoEstado(estado) !== 'bloqueado'"
              class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
            />
            {{ estado }}
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-stone-100 bg-stone-50/80 p-3 sm:p-4">
        <p
          v-if="errorMsg"
          class="text-xs text-red-600 mb-2 px-1"
        >
          {{ errorMsg }}
        </p>
        <p
          v-if="vozError"
          class="text-xs text-amber-700 mb-2 px-1"
        >
          {{ vozError }}
        </p>

        <div class="flex items-end gap-2 bg-white rounded-2xl border border-stone-200 shadow-sm p-2 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/15 transition">
          <textarea
            ref="inputRef"
            v-model="pregunta"
            rows="1"
            placeholder="Escribe tu pregunta..."
            class="flex-1 resize-none max-h-32 px-3 py-2.5 bg-transparent outline-none text-[15px] text-stone-800 placeholder:text-stone-400"
            @keydown="handleKeydown"
          />

          <div class="flex items-center gap-1 shrink-0 pb-1">
            <button
              v-if="vozDisponible"
              type="button"
              @click="toggleVoz"
              :disabled="loading"
              :title="escuchando ? 'Detener voz' : 'Hablar'"
              class="w-10 h-10 rounded-xl flex items-center justify-center transition"
              :class="escuchando
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'"
            >
              <Icon name="lucide:mic" class="size-5" />
            </button>

            <button
              v-if="loading"
              type="button"
              @click="detenerStream"
              class="w-10 h-10 rounded-xl bg-stone-200 text-stone-700 hover:bg-stone-300 transition flex items-center justify-center"
              title="Detener"
            >
              <Icon name="lucide:square" class="size-4 fill-current" />
            </button>

            <button
              type="button"
              @click="enviar()"
              :disabled="loading || !pregunta.trim()"
              class="w-10 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition flex items-center justify-center shadow-sm"
              title="Enviar"
            >
              <Icon name="lucide:arrow-up" class="size-5" />
            </button>
          </div>
        </div>

        <p class="text-[11px] text-stone-400 mt-2 text-center hidden sm:block">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  </div>
</template>
