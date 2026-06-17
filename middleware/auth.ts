export default defineNuxtRouteMiddleware(() => {

  if (process.client) {

    const usuarioGuardado =
      localStorage.getItem(
        "usuario"
      );

    if (!usuarioGuardado) {

      return navigateTo(
        "/login"
      );

    }

    const usuario =
      useState<any>(
        "usuario",
        () => null
      );

    if (!usuario.value) {

      usuario.value =
        JSON.parse(
          usuarioGuardado
        );

    }

  }

});