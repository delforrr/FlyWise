<script setup lang="ts">
import { computed } from "vue";

interface Props {
  message?: "Alta" | "Media" | "Baja";
  value?: number;
}

const props = withDefaults(defineProps<Props>(), {
  message: "Alta",
});

// Nivel de confiabilidad
const reliabilityLevel = computed<"Alta" | "Media" | "Baja">(() => {
  if (props.value !== undefined) {
    if (props.value >= 85) return "Alta";
    if (props.value >= 60) return "Media";
    return "Baja";
  }
  return props.message ?? "Alta";
});

// Valor numérico formateado
const scoreText = computed<string>(() => {
  if (props.value !== undefined) {
    return `${props.value.toFixed(1)}% OTP-15`;
  }
  if (reliabilityLevel.value === "Alta") return "≥ 85%";
  if (reliabilityLevel.value === "Media") return "60% – 85%";
  return "< 60%";
});

// Icono vectorial por nivel (Dual Sensory Encoding para accesibilidad y daltonismo)
const badgeIcon = computed<string>(() => {
  if (reliabilityLevel.value === "Alta") return "i-lucide-shield-check";
  if (reliabilityLevel.value === "Media") return "i-lucide-alert-triangle";
  return "i-lucide-clock-alert";
});

// Color del badge UBadge (Emerald / Amber / Carmine-Red)
const badgeColor = computed<"success" | "warning" | "error">(() => {
  if (reliabilityLevel.value === "Alta") return "success";
  if (reliabilityLevel.value === "Media") return "warning";
  return "error";
});

// Micro indicador luminoso (punto de pulso)
const dotClass = computed<string>(() => {
  if (reliabilityLevel.value === "Alta") return "bg-success";
  if (reliabilityLevel.value === "Media") return "bg-warning";
  return "bg-error";
});

// Etiqueta accesible dinámica para lectores de pantalla
const ariaLabel = computed<string>(() => {
  const formattedScore =
    props.value !== undefined
      ? `${props.value.toFixed(1)}%`
      : scoreText.value;
  return `Confiabilidad ${reliabilityLevel.value}: ${formattedScore} OTP-15`;
});
</script>

<template>
  <UBadge
    :color="badgeColor"
    variant="subtle"
    size="sm"
    role="status"
    :aria-label="ariaLabel"
    class="font-mono font-medium rounded-full select-none gap-1.5 inline-flex items-center"
  >
    <span class="inline-flex items-center gap-1 shrink-0" aria-hidden="true">
      <span
        class="inline-block w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
        :class="dotClass"
      />
      <UIcon :name="badgeIcon" class="w-3.5 h-3.5 shrink-0" />
    </span>
    <span>{{ reliabilityLevel }}</span>
    <span class="font-mono tabular-nums">({{ scoreText }})</span>
  </UBadge>
</template>
