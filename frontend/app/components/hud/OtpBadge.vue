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

const badgeClass = computed<string>(() => {
  if (reliabilityLevel.value === "Alta") return "badge-otp-good";
  if (reliabilityLevel.value === "Media") return "badge-otp-warning";
  return "badge-otp-critical";
});

const dotClass = computed<string>(() => {
  if (reliabilityLevel.value === "Alta") return "bg-otp-good";
  if (reliabilityLevel.value === "Media") return "bg-otp-warning";
  return "bg-otp-critical";
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-mono text-xs font-medium rounded-full px-2.5 py-0.5 shadow-sm transition-colors select-none',
      badgeClass,
    ]"
  >
    <span
      class="inline-block w-2 h-2 rounded-full mr-1.5 animate-pulse shrink-0"
      :class="dotClass"
    />
    <span>{{ reliabilityLevel }} confiabilidad ({{ scoreText }})</span>
  </span>
</template>
