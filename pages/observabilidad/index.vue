<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const { data: logs } = await useFetch("/api/observabilidad");
const { data: activityLogs } = await useFetch("/api/observabilidad/activity");

function parseTools(raw: unknown) {
  if (!raw) return [];

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTps(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toFixed(2);
}

function yesNo(value: unknown) {
  return Number(value) === 1 || value === true ? "Si" : "No";
}
</script>

<template>
  <div>
    <h1 class="text-4xl font-bold mb-3">
      Observabilidad IA
    </h1>
    <p class="text-gray-500 mb-8">
      Auditoría de latencia, guardrails y herramientas ejecutadas.
    </p>

    <div class="bg-white rounded-3xl border border-gray-100 overflow-x-auto">
      <table class="w-full min-w-[1600px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-4 text-left">ID</th>
            <th class="p-4 text-left">Sesión</th>
            <th class="p-4 text-left">Prompt</th>
            <th class="p-4 text-left">Respuesta</th>
            <th class="p-4 text-left">Agente</th>
            <th class="p-4 text-left">Intencion</th>
            <th class="p-4 text-left">Bloqueado</th>
            <th class="p-4 text-left">TTFT</th>
            <th class="p-4 text-left">Latencia</th>
            <th class="p-4 text-left">TPS</th>
            <th class="p-4 text-left">Herramientas</th>
            <th class="p-4 text-left">RAG</th>
            <th class="p-4 text-left">Fecha</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="log in logs"
            :key="log.id"
            class="border-t align-top"
          >
            <td class="p-4">{{ log.id }}</td>
            <td class="p-4 text-xs text-gray-500 max-w-[100px] truncate">
              {{ log.session_id }}
            </td>
            <td class="p-4 max-w-[180px]">
              <span class="line-clamp-2">{{ log.user_prompt }}</span>
            </td>
            <td class="p-4 max-w-[180px]">
              <span class="line-clamp-2">{{ log.system_response }}</span>
            </td>
            <td class="p-4 font-semibold capitalize">
              {{ log.selected_agent || "direct" }}
            </td>
            <td class="p-4 text-sm max-w-[150px]">
              <div>{{ log.intent || "-" }}</div>
              <div class="text-xs text-gray-500">
                Confianza: {{ log.confidence != null ? Number(log.confidence).toFixed(2) : "-" }}
              </div>
            </td>
            <td class="p-4">
              <span
                v-if="log.was_blocked"
                class="text-red-600 font-bold"
              >
                Sí
              </span>
              <span
                v-else
                class="text-green-600 font-bold"
              >
                No
              </span>
            </td>
            <td class="p-4">
              {{ log.ttft_ms != null ? `${log.ttft_ms} ms` : "—" }}
            </td>
            <td class="p-4">
              {{ log.total_latency_ms }} ms
            </td>
            <td class="p-4">
              {{ formatTps(log.tokens_per_second) }}
            </td>
            <td class="p-4 text-xs text-gray-600 max-w-[240px]">
              <div
                v-for="(tool, index) in parseTools(log.tools_executed)"
                :key="index"
                class="mb-1"
              >
                <span class="font-semibold">{{ tool.name }}</span>
                <span
                  :class="tool.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'"
                >
                  ({{ tool.status }})
                </span>
              </div>
              <span v-if="!parseTools(log.tools_executed).length">—</span>
            </td>
            <td class="p-4 text-xs whitespace-nowrap">
              <div>Recuperados: {{ log.retrieved_count ?? 0 }}</div>
              <div>Rerankeados: {{ log.reranked_count ?? 0 }}</div>
              <div>Reranker: {{ yesNo(log.reranker_used) }}</div>
              <div>Busqueda: {{ log.retrieval_latency_ms ?? 0 }} ms</div>
              <div>Rerank: {{ log.rerank_latency_ms ?? 0 }} ms</div>
            </td>
            <td class="p-4 text-sm text-gray-500 whitespace-nowrap">
              {{ log.timestamp }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="text-2xl font-bold mt-10 mb-4">Auditoria operativa</h2>
    <div class="bg-white rounded-3xl border border-gray-100 overflow-x-auto">
      <table class="w-full min-w-[900px]">
        <thead class="bg-gray-50"><tr><th class="p-4 text-left">Accion</th><th class="p-4 text-left">Entidad</th><th class="p-4 text-left">Actor</th><th class="p-4 text-left">Resultado</th><th class="p-4 text-left">Tiempo</th><th class="p-4 text-left">Fecha</th></tr></thead>
        <tbody>
          <tr v-for="item in activityLogs" :key="item.id" class="border-t">
            <td class="p-4 font-semibold">{{ item.action }}</td>
            <td class="p-4">{{ item.entity_type }} <span class="text-gray-400">#{{ item.entity_id }}</span></td>
            <td class="p-4">{{ item.actor_name || "Sistema" }}</td>
            <td class="p-4" :class="item.success ? 'text-emerald-700' : 'text-red-700'">{{ item.success ? "Correcto" : "Error" }}</td>
            <td class="p-4">{{ item.duration_ms != null ? `${item.duration_ms} ms` : "-" }}</td>
            <td class="p-4 text-sm text-gray-500">{{ item.created_at }}</td>
          </tr>
          <tr v-if="!activityLogs?.length"><td colspan="6" class="p-8 text-center text-gray-500">Sin actividad operativa registrada.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
