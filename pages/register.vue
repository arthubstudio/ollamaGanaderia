```vue
<script setup lang="ts">

const nombre = ref("");
const email = ref("");
const password = ref("");

const loading = ref(false);
const error = ref("");

// Expresión regular para validar el correo
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register() {

  error.value = "";

  // Validar nombre
  if (!nombre.value.trim()) {

    error.value = "Ingresa tu nombre.";
    return;

  }

  // Validar correo
  if (!emailRegex.test(email.value.trim())) {

    error.value = "Ingresa un correo electrónico válido.";
    return;

  }

  // Validar contraseña
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

    await navigateTo("/login");

  }

  catch (err: any) {

    error.value =
      err?.data?.statusMessage ??
      "Error al registrar usuario";

  }

  finally {

    loading.value = false;

  }

}

</script>

<template>

  <div
    class="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl border border-gray-200 shadow"
  >

    <h1
      class="text-4xl font-bold mb-8 text-center"
    >
      Crear Cuenta
    </h1>

    <div
      class="space-y-4"
    >

      <input
        v-model="nombre"
        type="text"
        placeholder="Nombre"
        class="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-black"
      >

      <input
        v-model="email"
        type="email"
        placeholder="Correo electrónico"
        class="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-black"
      >

      <input
        v-model="password"
        type="password"
        placeholder="Contraseña"
        class="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-black"
      >

      <button
        @click="register"
        :disabled="loading"
        class="w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50"
      >
        {{ loading ? "Creando cuenta..." : "Registrarme" }}
      </button>

      <div
        v-if="error"
        class="text-red-500 text-center"
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

</template>
```
