// https://nuxt.com/docs/api/configuration/nuxt-config
const configuredAllowedHosts = String(process.env.NUXT_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  devtools: {
    enabled: false
  },

  sourcemap: {
    client: false,
    server: false
  },

  runtimeConfig: {
    sessionSecret: process.env.NUXT_SESSION_SECRET || "",
    publicAppOrigin: process.env.NUXT_PUBLIC_APP_ORIGIN || "",
    allowedHosts: process.env.NUXT_ALLOWED_HOSTS || "",
    trustProxy: process.env.NUXT_TRUST_PROXY || ""
  },

  nitro: {
    errorHandler: "~/server/error-handler.ts",
    sourceMap: false,
    experimental: {
      websocket: true
    }
  },

  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxt/icon"
  ],

  icon: {
    provider: "server",
    fallbackToApi: false,
    serverBundle: {
      collections: ["lucide", "mdi"]
    }
  },

  routeRules: {
    "/vacas": { redirect: "/bovinos" },
    "/vacas/**": { redirect: "/bovinos/**" }
  },

  vite: {
    server: {
      allowedHosts: [
        "localhost",
        "127.0.0.1",
        "::1",
        ...configuredAllowedHosts
      ]
    }
  }
})
