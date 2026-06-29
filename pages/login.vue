<script setup lang="ts">
definePageMeta({
  layout: "auth"
});

const route = useRoute();
const email = ref("pedro@gmail.com");
const password = ref("123456");
const loading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

const usuario = useState<any>("usuario", () => null);

onMounted(() => {
  if (route.query.registrado === "1") {
    successMsg.value = "¡Cuenta creada exitosamente! Ya puedes iniciar sesión.";
  }

  if (typeof route.query.email === "string" && route.query.email.trim()) {
    email.value = route.query.email.trim();
  }
});

async function login() {
  if (!email.value.trim() || !password.value) {
    errorMsg.value = "Completa email y contraseña.";
    return;
  }

  loading.value = true;
  errorMsg.value = "";
  successMsg.value = "";

  try {
    const response = await $fetch("/api/auth/login", {
      method: "POST",
      body: {
        email: email.value,
        password: password.value
      }
    });

    usuario.value = response;
    localStorage.setItem("usuario", JSON.stringify(response));
    await navigateTo("/");
  } catch {
    errorMsg.value = "Credenciales incorrectas. Verifica tu email y contraseña.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex">
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.04%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
      <div class="relative z-10 flex flex-col justify-between p-12 text-white w-full">
        <div>
          <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/10 text-sm">
            Sistema ganadero con IA local
          </div>
        </div>

        <div class="max-w-md">
          <h1 class="text-4xl xl:text-5xl font-bold leading-tight">
            Tu rancho, bajo control inteligente
          </h1>
          <p class="mt-6 text-emerald-100/90 text-lg leading-relaxed">
            Consulta bovinos, vacunas y pesos con lenguaje natural. Todo en un solo lugar, rápido e intuitivo.
          </p>

          <div class="mt-10 space-y-3 text-emerald-50/90">
            <p>Chat con streaming en tiempo real</p>
            <p>Entrada por voz desde el navegador</p>
            <p>Seguridad y auditoría integradas</p>
          </div>
        </div>

        <p class="text-emerald-200/60 text-sm">
          Ganadería IA · UTM
        </p>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center p-6 sm:p-10">
      <div class="w-full max-w-md">
        <div class="lg:hidden mb-8 text-center text-white">
          <h1 class="text-2xl font-bold">
            Ganadería IA
          </h1>
        </div>

        <div class="bg-white rounded-3xl shadow-2xl shadow-black/20 p-8 sm:p-10">
          <div class="mb-8">
            <h2 class="text-2xl font-bold text-stone-900">
              Bienvenido de nuevo
            </h2>
            <p class="text-stone-500 mt-2">
              Inicia sesión para acceder a tu panel ganadero
            </p>
          </div>

          <form
            class="space-y-5"
            @submit.prevent="login"
          >
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2">
                Correo electrónico
              </label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="tu@email.com"
                class="w-full px-4 py-3.5 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2">
                Contraseña
              </label>
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full px-4 py-3.5 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
              >
            </div>

            <p
              v-if="successMsg"
              class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3"
            >
              {{ successMsg }}
            </p>

            <p
              v-if="errorMsg"
              class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
            >
              {{ errorMsg }}
            </p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition shadow-lg shadow-emerald-600/25"
            >
              {{ loading ? "Logging in..." : "Login" }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-stone-600">
            ¿No tienes cuenta?
            <NuxtLink
              to="/register"
              class="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Regístrate
            </NuxtLink>
          </p>

          <p class="mt-4 text-center text-xs text-stone-400">
            Demo: pedro@gmail.com · 123456
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
