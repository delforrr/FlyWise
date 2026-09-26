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
  if (reliabilityLevel.value === "Media") return "60% - 85%";
  return "< 60%";
});

const badgeColor = computed<"success" | "warning" | "error">(() => {
  if (reliabilityLevel.value === "Alta") return "success";
  if (reliabilityLevel.value === "Media") return "warning";
  return "error";
});

const dotClass = computed<string>(() => {
  if (reliabilityLevel.value === "Alta") return "bg-success";
  if (reliabilityLevel.value === "Media") return "bg-warning";
  return "bg-error";
});
</script>

<template>
  <UBadge
    :color="badgeColor"
    variant="subtle"
    size="sm"
    class="font-mono font-medium rounded-full select-none gap-1.5"
  >
    <span class="inline-block w-2 h-2 rounded-full shrink-0" :class="dotClass" />
    <span>{{ reliabilityLevel }} ({{ scoreText }})</span>
  </UBadge>
</template>
