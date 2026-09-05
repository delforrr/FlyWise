<script setup lang="ts">
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

// Clases semánticas de app.css
const badgeColor = computed<"success" | "warning" | "error">(() => {
  if (reliabilityLevel.value === "Alta") return "success";
  if (reliabilityLevel.value === "Media") return "warning";
  return "error";
});

const badgeClass = computed<string>(() => {
  if (reliabilityLevel.value === "Alta") return "badge-otp-good";
  if (reliabilityLevel.value === "Media") return "badge-otp-warning";
  return "badge-otp-critical";
});
</script>

<template>
  <UBadge
    :color="badgeColor"
    variant="subtle"
    size="md"
    :class="[
      'font-mono font-medium rounded-full px-3 py-1 shadow-sm transition-colors',
      badgeClass,
    ]"
  >
    <span
      class="inline-block w-2 h-2 rounded-full mr-1.5 animate-pulse"
      :class="{
        'bg-emerald-500': reliabilityLevel === 'Alta',
        'bg-amber-500': reliabilityLevel === 'Media',
        'bg-rose-500': reliabilityLevel === 'Baja',
      }"
    ></span>

    {{ reliabilityLevel }} confiabilidad ({{ scoreText }})
  </UBadge>
</template>
