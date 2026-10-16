<script setup lang="ts">
import { ref } from "vue";
import type { TableColumn } from "@nuxt/ui";
import type { EtlPipeline } from "../types/etl";

interface Props {
  services: EtlPipeline[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit", service: EtlPipeline): void;
  (e: "duplicate", id: string): void;
  (e: "delete", service: EtlPipeline): void;
  (e: "toggle-status", id: string): void;
  (e: "trigger-sync", service: EtlPipeline): void;
  (e: "test-endpoint", service: EtlPipeline): void;
}>();

const copiedEndpointId = ref<string | null>(null);

async function copyUrl(id: string, url: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    copiedEndpointId.value = id;
    setTimeout(() => {
      if (copiedEndpointId.value === id) {
        copiedEndpointId.value = null;
      }
    }, 1800);
  }
}

const columns: TableColumn<EtlPipeline>[] = [
  {
    accessorKey: "name",
    id: "name",
    header: "Servicio / Dataset",
  },
  {
    id: "entity",
    header: "Entidad Destino",
  },
  {
    id: "endpoint",
    header: "Endpoint & Conexión",
  },
  {
    id: "schedule",
    header: "Frecuencia",
  },
  {
    accessorKey: "status",
    id: "status",
    header: "Estado",
  },
  {
    id: "actions",
    header: "Acciones",
  },
];
</script>

<template>
  <div
    class="rounded-xl border border-border-subtle bg-surface-card overflow-hidden shadow-xs"
  >
    <UTable :data="services" :columns="columns" class="w-full text-xs font-sans">
      <!-- 1. Servicio / Dataset -->
      <template #name-cell="{ row }">
        <div class="flex items-center gap-2.5 min-w-56 py-1">
          <div
            class="w-8 h-8 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary shrink-0"
          >
            <UIcon :name="row.original.icon" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-text-main block truncate text-xs">
                {{ row.original.name }}
              </span>
              <UBadge
                v-if="row.original.isSystem"
                color="primary"
                variant="subtle"
                size="xs"
                class="font-mono text-[9px] shrink-0"
              >
                Sistema
              </UBadge>
              <UBadge
                v-else
                color="neutral"
                variant="outline"
                size="xs"
                class="font-mono text-[9px] shrink-0"
              >
                Custom
              </UBadge>
            </div>
            <span class="text-[11px] text-text-muted block truncate font-mono">
              {{ row.original.datasetName }}
            </span>
          </div>
        </div>
      </template>

      <!-- 2. Entidad Destino -->
      <template #entity-cell="{ row }">
        <div class="min-w-36">
          <UBadge
            v-if="row.original.targetEntity === 'airports'"
            color="primary"
            variant="subtle"
            size="sm"
            class="gap-1 font-mono text-[11px]"
          >
            <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5" />
            Aeropuertos
          </UBadge>
          <UBadge
            v-else-if="row.original.targetEntity === 'routes'"
            color="info"
            variant="subtle"
            size="sm"
            class="gap-1 font-mono text-[11px]"
          >
            <UIcon name="i-lucide-route" class="w-3.5 h-3.5" />
            Rutas
          </UBadge>
          <UBadge
            v-else
            color="secondary"
            variant="subtle"
            size="sm"
            class="gap-1 font-mono text-[11px]"
          >
            <UIcon name="i-lucide-timer" class="w-3.5 h-3.5" />
            Telemetría OTP
          </UBadge>
        </div>
      </template>

      <!-- 3. Endpoint & Conexión -->
      <template #endpoint-cell="{ row }">
        <div class="min-w-64 max-w-xs space-y-1 py-1">
          <div class="flex items-center gap-1.5">
            <UBadge
              color="neutral"
              variant="subtle"
              size="xs"
              class="font-mono font-bold text-[10px]"
            >
              {{ row.original.connection?.httpMethod || "GET" }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="outline"
              size="xs"
              class="font-mono uppercase text-[9px]"
            >
              {{ row.original.connection?.dataFormat || "CSV" }}
            </UBadge>
          </div>

          <div class="flex items-center gap-1.5">
            <span
              class="font-mono text-[11px] text-text-dim truncate max-w-56"
              :title="row.original.connection?.endpointUrl"
            >
              {{ row.original.connection?.endpointUrl || "https://..." }}
            </span>
            <UButton
              v-if="row.original.connection?.endpointUrl"
              size="xs"
              variant="ghost"
              color="neutral"
              :icon="
                copiedEndpointId === row.original.id
                  ? 'i-lucide-check'
                  : 'i-lucide-copy'
              "
              class="cursor-pointer shrink-0"
              @click="
                copyUrl(
                  row.original.id,
                  row.original.connection?.endpointUrl || '',
                )
              "
            />
          </div>
        </div>
      </template>

      <!-- 4. Frecuencia -->
      <template #schedule-cell="{ row }">
        <div class="min-w-36 space-y-0.5">
          <span class="text-xs font-semibold text-text-main block">
            {{ row.original.scheduleDescription }}
          </span>
          <span
            v-if="row.original.scheduleConfig?.cronExpression"
            class="font-mono text-[10px] text-text-dim block"
          >
            cron: {{ row.original.scheduleConfig.cronExpression }}
          </span>
        </div>
      </template>

      <!-- 5. Estado & Switch -->
      <template #status-cell="{ row }">
        <div class="flex items-center gap-2 min-w-32">
          <UBadge
            v-if="row.original.status === 'success'"
            color="success"
            variant="subtle"
            size="sm"
            class="font-mono text-[11px] gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Al día
          </UBadge>
          <UBadge
            v-else-if="row.original.status === 'running'"
            color="info"
            variant="subtle"
            size="sm"
            class="font-mono text-[11px] gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
            Activo
          </UBadge>
          <UBadge
            v-else-if="row.original.status === 'paused'"
            color="warning"
            variant="subtle"
            size="sm"
            class="font-mono text-[11px] gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pausado
          </UBadge>
          <UBadge
            v-else-if="row.original.status === 'error'"
            color="error"
            variant="subtle"
            size="sm"
            class="font-mono text-[11px] gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Error
          </UBadge>
          <UBadge
            v-else
            color="neutral"
            variant="subtle"
            size="sm"
            class="font-mono text-[11px]"
          >
            En espera
          </UBadge>
        </div>
      </template>

      <!-- 6. Acciones -->
      <template #actions-cell="{ row }">
        <div class="flex items-center gap-1 min-w-36 justify-end">
          <UTooltip text="Iniciar Ingesta Manual">
            <UButton
              size="xs"
              variant="ghost"
              color="primary"
              icon="i-lucide-play"
              class="cursor-pointer"
              @click="emit('trigger-sync', row.original)"
            />
          </UTooltip>

          <UTooltip text="Editar Servicio y Endpoint">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              class="cursor-pointer"
              @click="emit('edit', row.original)"
            />
          </UTooltip>

          <UTooltip text="Duplicar Configuración">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-copy"
              class="cursor-pointer"
              @click="emit('duplicate', row.original.id)"
            />
          </UTooltip>

          <UTooltip
            :text="
              row.original.status === 'paused'
                ? 'Reanudar Servicio'
                : 'Pausar Servicio'
            "
          >
            <UButton
              size="xs"
              variant="ghost"
              :color="row.original.status === 'paused' ? 'success' : 'warning'"
              :icon="
                row.original.status === 'paused'
                  ? 'i-lucide-check-circle'
                  : 'i-lucide-pause'
              "
              class="cursor-pointer"
              @click="emit('toggle-status', row.original.id)"
            />
          </UTooltip>

          <UTooltip
            :text="
              row.original.isSystem
                ? 'Los servicios del sistema no se pueden eliminar'
                : 'Eliminar Servicio'
            "
          >
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              :disabled="row.original.isSystem"
              class="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              @click="emit('delete', row.original)"
            />
          </UTooltip>
        </div>
      </template>
    </UTable>
  </div>
</template>
