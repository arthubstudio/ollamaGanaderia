<script setup lang="ts">

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

if (
  process.client &&
  !usuario.value
) {

  const guardado =
    localStorage.getItem(
      "usuario"
    );

  if (guardado) {

    usuario.value =
      JSON.parse(
        guardado
      );

  }

}

</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>