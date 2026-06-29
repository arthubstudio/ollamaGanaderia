<script setup lang="ts">
definePageMeta({
  layout: "auth"
});

const nombre = ref("");
const email = ref("");
const password = ref("");

const loading = ref(false);
const error = ref("");
const success = ref(false);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register() {
  error.value = "";
  success.value = false;

  if (!nombre.value.trim()) {
    error.value = "Ingresa tu nombre.";
    return;
  }

  if (!emailRegex.test(email.value.trim())) {
    error.value = "Ingresa un correo electrónico válido.";
    return;
  }

  if (password.value.length < 6) {
    error.value = "La contraseña debe tener al menos 6 caracteres.";
    return;
  }

  try {
    loading.value = true;

    await $fetch("/api/auth/register", {
      method: "POST",
      body: {
        nombre: nombre.value.trim(),
        email: email.value.trim().toLowerCase(),
        password: password.value
      }
    });

    success.value = true;

    setTimeout(async () => {
      await navigateTo({
        path: "/login",
        query: {
          registrado: "1",
          email: email.value.trim().toLowerCase()
        }
      });
    }, 2500);
  } catch (err: any) {
    error.value =
      err?.data?.statusMessage ?? "Error al registrar usuario";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 sm:p-10">
    <div class="w-full max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow">
      <h1 class="text-4xl font-bold mb-8 text-center">
        Crear Cuenta
      </h1>

      <div
        v-if="success"
        class="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center"
      >
        <p class="font-semibold text-emerald-800">
          ¡Cuenta creada exitosamente!
        </p>
        <p class="text-sm text-emerald-700 mt-1">
          Redirigiendo al inicio de sesión...
        </p>
      </div>

      <div class="space-y-4">
        <input
          v-model="nombre"
          type="text"
          placeholder="Nombre"
          :disabled="success"
          class="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-black disabled:opacity-60"
        >

        <input
          v-model="email"
          type="email"
          placeholder="Correo electrónico"
          :disabled="success"
          class="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-black disabled:opacity-60"
        >

        <input
          v-model="password"
          type="password"
          placeholder="Contraseña"
          :disabled="success"
          class="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-black disabled:opacity-60"
        >

        <button
          :disabled="loading || success"
          class="w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50"
          @click="register"
        >
          {{ loading ? "Creando cuenta..." : success ? "Cuenta creada" : "Registrarme" }}
        </button>

        <div
          v-if="error"
          class="text-red-500 text-center text-sm"
        >
          {{ error }}
        </div>

        <NuxtLink
          to="/login"
          class="block text-center text-blue-600 hover:underline"
        >
          Ya tengo cuenta
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
