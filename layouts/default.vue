<script setup lang="ts">
const route = useRoute();
const usuario = useState<any>("usuario", () => null);

const navItems = [
  { to: "/", label: "Inicio", icon: "lucide:home" },
  { to: "/vacas", label: "Vacas", icon: "mdi:cow" },
  { to: "/ia", label: "Asistente IA", icon: "lucide:sparkles" },
  { to: "/observabilidad", label: "Observabilidad", icon: "lucide:bar-chart-3" }
];

function isActive(path: string) {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
}

function cerrarSesion() {
  if (process.client) {
    localStorage.removeItem("usuario");
  }

  usuario.value = null;
  navigateTo("/login");
}
</script>

<template>
  <div class="min-h-screen bg-stone-100 flex">
    <aside class="hidden lg:flex w-72 bg-white border-r border-stone-200 flex-col shadow-sm">
      <div class="p-6 border-b border-stone-100">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <Icon name="mdi:cow" class="size-6" />
          </div>
          <div>
            <h1 class="text-lg font-bold text-stone-900 leading-tight">
              Ganadería IA
            </h1>
            <p class="text-stone-500 text-xs mt-0.5">
              Gestión inteligente
            </p>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-4 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all"
          :class="isActive(item.to)
            ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100'
            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
        >
          <Icon :name="item.icon" class="size-5 shrink-0" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="p-4 border-t border-stone-100">
        <div class="flex items-center gap-3 px-3 py-2">
          <div class="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
            {{ usuario?.nombre?.charAt(0) ?? "?" }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-sm text-stone-900 truncate">
              {{ usuario?.nombre ?? "Usuario" }}
            </p>
            <p class="text-xs text-stone-500 truncate">
              {{ usuario?.email ?? "" }}
            </p>
          </div>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 lg:h-20 bg-white/80 backdrop-blur border-b border-stone-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
        <div class="flex items-center gap-3 lg:hidden">
          <div class="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
            <Icon name="mdi:cow" class="size-5" />
          </div>
          <span class="font-bold text-stone-900">Ganadería IA</span>
        </div>

        <div class="hidden lg:block">
          <p class="text-xs uppercase tracking-wider text-stone-400 font-medium">
            Panel
          </p>
          <h2 class="text-xl font-bold text-stone-900">
            {{ navItems.find((item) => isActive(item.to))?.label ?? "Inicio" }}
          </h2>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <NuxtLink
            to="/ia"
            class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition shadow-sm"
          >
            <Icon name="lucide:sparkles" class="size-4" />
            Preguntar a la IA
          </NuxtLink>

          <button
            @click="cerrarSesion"
            class="px-3 sm:px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
          >
            Salir
          </button>
        </div>
      </header>

      <nav class="lg:hidden flex gap-1 overflow-x-auto px-4 py-2 bg-white border-b border-stone-100">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition"
          :class="isActive(item.to)
            ? 'bg-emerald-600 text-white'
            : 'bg-stone-100 text-stone-600'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
