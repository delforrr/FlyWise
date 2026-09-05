// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  devtools: { enabled: true },

  modules: ["@nuxt/ui"],

  icon: {
    serverBundle: {
      collections: ["lucide"],
    },
  },

  css: ["maplibre-gl/dist/maplibre-gl.css", "~/app.css"],

  build: {
    transpile: [
      /@deck\.gl/,
      /@probe\.gl/,
      /@loaders\.gl/,
      /@luma\.gl/,
      /@math\.gl/,
      "maplibre-gl",
    ],
  },

  vite: {
    optimizeDeps: {
      include: [
        "maplibre-gl",
        "@deck.gl/core",
        "@deck.gl/layers",
        "@deck.gl/mapbox",
        "@probe.gl/stats",
        "@probe.gl/env",
        "@probe.gl/log",
        "@loaders.gl/core",
        "@loaders.gl/images",
        "@luma.gl/core",
        "@luma.gl/engine",
        "@luma.gl/webgl",
        "@luma.gl/shadertools",
        "@math.gl/core",
        "@math.gl/web-mercator",
        "mjolnir.js",
        "gl-matrix",
      ],
    },
  },

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