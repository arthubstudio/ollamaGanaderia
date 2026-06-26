<script setup lang="ts">
definePageMeta({
  middleware: ["auth"]
});

const usuario = useState<any>("usuario", () => null);

const { data } = await useFetch("/api/dashboard", {
  query: {
    usuario_id: usuario.value?.id
  }
});

const hora = new Date().getHours();
const saludo =
  hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

const stats = computed(() => [
  {
    label: "Bovinos registrados",
    value: data.value?.totalBovinos ?? 0,
    suffix: "",
    icon: "mdi:cow",
    color: "from-emerald-500 to-emerald-700",
    bg: "bg-emerald-50"
  },
  {
    label: "Vacunas aplicadas",
    value: data.value?.vacunasAplicadas ?? 0,
    suffix: "",
    icon: "lucide:syringe",
    color: "from-sky-500 to-blue-600",
    bg: "bg-sky-50"
  },
  {
    label: "Peso promedio",
    value: data.value?.pesoPromedio ?? 0,
    suffix: " kg",
    icon: "lucide:scale",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-50"
  }
]);

const acciones = [
  {
    to: "/bovinos",
    title: "Gestionar bovinos",
    desc: "Registra vacas, toros y consulta tu ganado",
    icon: "mdi:cow",
    accent: "hover:border-emerald-300 hover:shadow-emerald-100"
  },
  {
    to: "/ia",
    title: "Asistente IA",
    desc: "Pregunta en lenguaje natural con voz",
    icon: "lucide:sparkles",
    accent: "hover:border-violet-300 hover:shadow-violet-100 ring-1 ring-violet-100"
  },
  {
    to: "/duenos",
    title: "Dueños",
    desc: "Administra propietarios del rancho",
    icon: "lucide:user",
    accent: "hover:border-stone-300"
  },
  {
    to: "/ranchos",
    title: "Ranchos",
    desc: "Ubicaciones y propiedades ganaderas",
    icon: "lucide:warehouse",
    accent: "hover:border-stone-300"
  },
  {
    to: "/observabilidad",
    title: "Observabilidad",
    desc: "Auditoría de consultas y latencia IA",
    icon: "lucide:bar-chart-3",
    accent: "hover:border-stone-300"
  }
];
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-8">
    <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-stone-900 text-white p-8 sm:p-10 shadow-xl shadow-emerald-900/20">
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl" />

      <div class="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <p class="text-emerald-200 text-sm font-medium">
            {{ saludo }}, {{ usuario?.nombre ?? "ganadero" }}
          </p>
          <h1 class="text-3xl sm:text-4xl font-bold mt-2 leading-tight">
            Tu rancho en un vistazo
          </h1>
          <p class="text-emerald-100/80 mt-3 max-w-xl text-base sm:text-lg">
            Revisa métricas clave y accede rápido a las herramientas que más usas.
          </p>
        </div>

        <NuxtLink
          to="/ia"
          class="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white text-emerald-800 font-semibold hover:bg-emerald-50 transition shadow-lg shrink-0"
        >
          <Icon name="lucide:sparkles" class="size-5" />
          Preguntar a la IA
        </NuxtLink>
      </div>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm hover:shadow-md transition"
      >
        <div class="flex items-start justify-between">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center"
            :class="stat.bg"
          >
            <Icon :name="stat.icon" class="size-6 text-stone-700" />
          </div>
          <div
            class="w-2 h-2 rounded-full bg-gradient-to-br opacity-80"
            :class="stat.color"
          />
        </div>
        <p class="text-stone-500 text-sm mt-5">
          {{ stat.label }}
        </p>
        <p class="text-3xl sm:text-4xl font-bold text-stone-900 mt-1">
          {{ stat.value }}{{ stat.suffix }}
        </p>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold text-stone-900">
          Accesos rápidos
        </h2>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <NuxtLink
          v-for="accion in acciones"
          :key="accion.to"
          :to="accion.to"
          class="group bg-white rounded-3xl p-6 border border-stone-100 shadow-sm transition hover:shadow-lg"
          :class="accion.accent"
        >
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-2xl bg-stone-50 group-hover:scale-105 transition flex items-center justify-center">
              <Icon :name="accion.icon" class="size-6 text-stone-700" />
            </div>
            <div>
              <h3 class="font-bold text-stone-900 group-hover:text-emerald-700 transition">
                {{ accion.title }}
              </h3>
              <p class="text-stone-500 text-sm mt-1 leading-relaxed">
                {{ accion.desc }}
              </p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="bg-white rounded-3xl border border-stone-100 p-6 sm:p-8 shadow-sm">
      <h2 class="text-lg font-bold text-stone-900 mb-4">
        Sugerencias para empezar
      </h2>
      <div class="flex flex-wrap gap-3">
        <NuxtLink
          to="/ia"
          class="px-4 py-2.5 rounded-full bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100 transition"
        >
          ¿Cuántos bovinos tengo?
        </NuxtLink>
        <NuxtLink
          to="/ia"
          class="px-4 py-2.5 rounded-full bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition"
        >
          ¿Qué bovinos tengo registrados?
        </NuxtLink>
        <NuxtLink
          to="/bovinos"
          class="px-4 py-2.5 rounded-full bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition"
        >
          Ver listado de bovinos
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
