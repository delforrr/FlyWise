<script setup lang="ts">
import { ref } from "vue";

const isDarkMode = ref(false);

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
}
</script>

<template>
  <UColorModeSwitch size="xl" color="primary" />
</template>
