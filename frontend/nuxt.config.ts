// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/ui"],
  ui: {
    theme: {
      colors: [
        "primary",
        "secondary",
        "tertiary",
        "success",
        "info",
        "warning",
        "error",
      ],
    },
  },
  css: ["~/app.css"],
  app: {
    head: {
      title: "FlyWise — Aeronautical Intelligence System",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Plataforma de inteligencia de rutas y confiabilidad de vuelos comerciales (OTP-15).",
        },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
    },
  },
});
