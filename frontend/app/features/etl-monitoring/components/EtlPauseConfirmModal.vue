<script setup lang="ts">
import type { ProcesoEtl } from "../types/etl";

interface Props {
  isOpen: boolean;
  proceso: ProcesoEtl | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm", id: string): void;
}>();

function handleConfirm() {
  if (props.proceso) {
    emit("confirm", props.proceso.id);
    emit("close");
  }
}
</script>

<template>
  <UModal
    :open="isOpen && !!proceso"
    title="Pausar Servicio de Ingesta"
    description="Esta acción suspenderá temporalmente la sincronización programada de este servicio."
    :ui="{
      content:
        'max-w-md bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="
      (val: boolean) => {
        if (!val) emit('close');
      }
    "
  >
    <template #body>
      <div v-if="proceso" class="space-y-3.5 text-xs">
        <div
          class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-600 dark:text-amber-400"
        >
          <UIcon
            name="i-lucide-pause-circle"
            class="w-5 h-5 shrink-0 mt-0.5 text-amber-500"
          />
          <div class="space-y-1">
            <span class="font-bold block text-text-main">
              ¿Confirmas la pausa del servicio?
            </span>
            <p class="text-[11px] leading-relaxed text-text-muted">
              Se congelarán las ejecuciones automáticas de
              <strong class="text-text-main font-semibold">"{{ proceso.nombre }}"</strong>
              en BullMQ. El proceso permanecerá inactivo hasta que decidas reanudarlo manualmente.
            </p>
          </div>
        </div>

        <div
          class="p-3 rounded-lg bg-surface-accent border border-border-subtle space-y-1.5 text-[11px]"
        >
          <div class="flex items-center justify-between">
            <span class="text-text-muted font-medium">Cadencia actual:</span>
            <span class="font-semibold text-text-main">
              {{ proceso.scheduleDescription }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-text-muted font-medium">Entidad destino:</span>
            <span class="font-mono text-primary font-bold capitalize">
              {{ proceso.entidadDestino || "otp_metrics" }}
            </span>
          </div>
          <div class="pt-1 border-t border-border-subtle/60 flex items-center gap-1.5 text-text-dim font-mono text-[10px] truncate">
            <UIcon name="i-lucide-link" class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">
              {{ proceso.conexion?.urlEndpoint || "Sin endpoint registrado" }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          class="text-xs font-semibold cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </UButton>
        <UButton
          color="warning"
          size="sm"
          icon="i-lucide-pause"
          class="text-xs font-semibold cursor-pointer text-white"
          @click="handleConfirm"
        >
          Confirmar Pausa
        </UButton>
      </div>
    </template>
  </UModal>
</template>
