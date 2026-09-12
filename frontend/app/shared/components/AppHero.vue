<script setup lang="ts">
interface FeatureProps {
  title: string;
  description: string;
  icon: string;
}

const features: FeatureProps[] = [
  {
    title: "Mapa Interactivo",
    description: "Navegación fluida y controles flexibles.",
    icon: "i-lucide-map",
  },
  {
    title: "Puntualidad OTP-15",
    description: "Estándar internacional de retrasos por tramo y aerolínea.",
    icon: "i-lucide-clock",
  },
  {
    title: "Auditoría de Rutas",
    description: "Desempeño histórico y confiabilidad para vuelos comerciales.",
    icon: "i-lucide-route",
  },
];
</script>

<template>
  <div class="flex flex-col w-full max-w-4xl px-6 gap-0">
    <UPageSection
      description="Análisis de demoras, puntualidad OTP-15 y telemetría para aerolíneas comerciales y viajeros frecuentes."
      orientation="vertical"
      :features="features"
    >
      <template #title>
        Información de Vuelo y
        <span
          class="inline-block drop-shadow-[0_4px_14px_color-mix(in_srgb,var(--color-primary)_45%,transparent)]"
        >
          <span
            class="bg-linear-to-r from-secondary to-primary bg-clip-text text-transparent"
          >
            Confiabilidad en Tiempo Real
          </span>
        </span>
      </template>
    </UPageSection>
    <UPageLogos title="Dejá tu estrella">
      <ULink
        as="button"
        to="https://github.com/delforrr/FlyWise"
        target="_blank"
        ><UIcon name="i-lucide-github" class="size-7 shrink-0"></UIcon
      ></ULink>
    </UPageLogos>
  </div>
</template>
