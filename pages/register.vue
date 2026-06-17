<script setup lang="ts">

const nombre = ref("");
const email = ref("");
const password = ref("");

const loading = ref(false);
const error = ref("");

async function register() {

  try {

    loading.value = true;
    error.value = "";

    await $fetch(
      "/api/auth/register",
      {

        method: "POST",

        body: {

          nombre:
            nombre.value,

          email:
            email.value,

          password:
            password.value

        }

      }
    );

    await navigateTo("/login");

  }

  catch (err: any) {

    error.value =
      err?.data?.statusMessage
      ?? "Error al registrar usuario";

  }

  finally {

    loading.value = false;

  }

}

</script>

<template>

  <div
    class="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl border border-gray-200"
  >

    <h1
      class="text-4xl font-bold mb-8"
    >
      Crear Cuenta
    </h1>

    <div
      class="space-y-4"
    >

      <input
        v-model="nombre"
        placeholder="Nombre"
        class="w-full border border-gray-300 rounded-xl p-3"
      >

      <input
        v-model="email"
        placeholder="Correo"
        class="w-full border border-gray-300 rounded-xl p-3"
      >

      <input
        v-model="password"
        type="password"
        placeholder="Contraseña"
        class="w-full border border-gray-300 rounded-xl p-3"
      >

      <button
        @click="register"
        :disabled="loading"
        class="w-full bg-black text-white py-3 rounded-xl"
      >

        {{ loading
          ? "Creando cuenta..."
          : "Registrarme"
        }}

      </button>

      <div
        v-if="error"
        class="text-red-500"
      >
        {{ error }}
      </div>

      <NuxtLink
        to="/login"
        class="block text-center text-blue-600"
      >
        Ya tengo cuenta
      </NuxtLink>

    </div>

  </div>

</template>