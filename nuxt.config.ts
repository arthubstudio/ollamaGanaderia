// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    sessionSecret: process.env.NUXT_SESSION_SECRET || "ganaderia-ai-local-dev-change-me"
  },
  nitro: {
    errorHandler: "~/server/error-handler.ts"
  },
  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxt/icon"
  ],
  routeRules: {
    "/vacas": { redirect: "/bovinos" },
    "/vacas/**": { redirect: "/bovinos/**" }
  },
  vite: {
    server: {
      allowedHosts: true
    }
  }
})
