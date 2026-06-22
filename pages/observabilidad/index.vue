<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const { data: logs } = await useFetch("/api/observabilidad");

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
      <table class="w-full min-w-[1200px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-4 text-left">ID</th>
            <th class="p-4 text-left">Sesión</th>
            <th class="p-4 text-left">Prompt</th>
            <th class="p-4 text-left">Respuesta</th>
            <th class="p-4 text-left">Bloqueado</th>
            <th class="p-4 text-left">TTFT</th>
            <th class="p-4 text-left">Latencia</th>
            <th class="p-4 text-left">TPS</th>
            <th class="p-4 text-left">Herramientas</th>
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
            <td class="p-4 text-sm text-gray-500 whitespace-nowrap">
              {{ log.timestamp }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
