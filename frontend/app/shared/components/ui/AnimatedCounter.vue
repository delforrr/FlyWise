<script setup lang="ts">
import { computed } from "vue";
import { useAnimatedNumber } from "~/shared/composables/useAnimatedNumber";

interface Props {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatLocale?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  duration: 750,
  prefix: "",
  suffix: "",
  formatLocale: false,
});

const animatedValue = useAnimatedNumber(() => props.value, {
  duration: () => props.duration,
});

function getDecimalPlaces(num: number): number {
  if (Math.floor(num) === num) return 0;
  const str = num.toString();
  const dotIndex = str.indexOf(".");
  return dotIndex !== -1 ? str.length - dotIndex - 1 : 0;
}

const formattedValue = computed(() => {
  const val = animatedValue.value;
  if (!Number.isFinite(val)) {
    return "0";
  }

  const dec =
    props.decimals !== undefined
      ? props.decimals
      : getDecimalPlaces(props.value);

  // Avoid displaying -0
  const safeVal = Math.abs(val) < 1e-9 ? 0 : val;

  if (props.formatLocale) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(safeVal);
  }

  return dec > 0 ? safeVal.toFixed(dec) : Math.round(safeVal).toString();
});
</script>

<template>
  <span class="font-mono tabular-nums tracking-tight">
    <slot :formatted="formattedValue" :value="animatedValue">
      {{ prefix }}{{ formattedValue }}{{ suffix }}
    </slot>
  </span>
</template>
