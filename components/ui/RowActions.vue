<script setup lang="ts">
const props = defineProps<{
  viewTo: string
  editTo: string
  deleteAction: () => Promise<void>
}>()

const loading = ref(false)

async function onDelete() {
  const ok = confirm("¿Seguro que quieres eliminar este registro?")
  if (!ok) return

  loading.value = true
  try {
    await props.deleteAction()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex gap-2">
    <NuxtLink
      :to="viewTo"
      class="px-3 py-2 rounded-xl text-sm bg-gray-100 hover:bg-gray-200"
    >
      Ver
    </NuxtLink>

    <NuxtLink
      :to="editTo"
      class="px-3 py-2 rounded-xl text-sm bg-black text-white hover:opacity-90"
    >
      Editar
    </NuxtLink>

    <button
      @click="onDelete"
      :disabled="loading"
      class="px-3 py-2 rounded-xl text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
    >
      {{ loading ? "..." : "Eliminar" }}
    </button>
  </div>
</template>