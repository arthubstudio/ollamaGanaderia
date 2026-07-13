export default defineNuxtRouteMiddleware(async () => {
  if (!process.client) return;

  const usuario = useState<any>("usuario", () => null);

  try {
    const sessionUser = await $fetch("/api/auth/me");
    usuario.value = sessionUser;
    localStorage.setItem("usuario", JSON.stringify(sessionUser));
  } catch {
    usuario.value = null;
    localStorage.removeItem("usuario");
    return navigateTo("/login");
  }
});
