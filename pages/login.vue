<script setup lang="ts">

const email = ref("");
const password = ref("");

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

async function login() {

  const response =
    await $fetch(
      "/api/auth/login",
      {
        method: "POST",

        body: {

          email:
            email.value,

          password:
            password.value

        }

      }
    );

  usuario.value =
    response;

    localStorage.setItem(
    "usuario",
    JSON.stringify(response)
    );

  await navigateTo("/");

}

</script>

<template>

  <div
    class="max-w-md mx-auto mt-20"
  >

    <h1
      class="text-4xl font-bold mb-6"
    >
      Login
    </h1>

    <input
      v-model="email"
      placeholder="Email"
      class="w-full border p-3 mb-4"
    >

    <input
      v-model="password"
      type="password"
      placeholder="Contraseña"
      class="w-full border p-3 mb-4"
    >

    <button
      @click="login"
      class="bg-black text-white px-6 py-3"
    >
      Entrar
    </button>

  </div>

</template>