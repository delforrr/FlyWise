<script setup lang="ts">
import OtpBadge from "./HudOtpBadge.vue";
import HudContainer from "./containers/HudContainer.vue";
</script>

<template>
  <UCollapsible default-open class="group w-80">
    <UButton
      color="neutral"
      variant="subtle"
      trailing-icon="i-lucide-chevron-down"
      :ui="{
        trailingIcon:
          'group-data-[state=open]:rotate-180 transition-transform duration-200',
        base: 'justify-between w-full',
      }"
      block
      class="btn-hud-secondary"
    >
      <span class="hud-legend">Confiabilidad OTP</span>
    </UButton>

    <template #content>
      <HudContainer variant="box" rounded="xl" class="mt-2 w-full p-4">
        <div class="flex flex-col gap-3">
          <OtpBadge message="Alta" />
          <OtpBadge message="Media" />
          <OtpBadge message="Baja" />
        </div>
      </HudContainer>
    </template>
  </UCollapsible>
</template>
