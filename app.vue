<script setup lang="ts">

const usuario =
  useState<any>(
    "usuario",
    () => null
  );

</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
