<script setup lang="ts">
import { ref } from "vue";
import type { TableColumn } from "@nuxt/ui";
import type { ProcesoEtl } from "../types/etl";

interface Props {
  services: ProcesoEtl[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit", service: ProcesoEtl): void;
  (e: "duplicate", id: string): void;
  (e: "delete", service: ProcesoEtl): void;
  (e: "toggle-estado", service: ProcesoEtl): void;
  (e: "trigger-sync", service: ProcesoEtl): void;
  (e: "test-endpoint", service: ProcesoEtl): void;
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

const columns: TableColumn<ProcesoEtl>[] = [
  {
    accessorKey: "nombre",
    id: "nombre",
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
    accessorKey: "estado",
    id: "estado",
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
    class="rounded-xl border border-border-subtle bg-surface-card overflow-hidden shadow-xs relative"
  >
    <UTable :data="services" :columns="columns" class="w-full text-xs font-sans">
      <!-- 1. Servicio / Dataset -->
      <template #nombre-cell="{ row }">
        <div class="flex items-center gap-2 min-w-44 max-w-56 py-1">
          <div
            class="w-7 h-7 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary shrink-0"
          >
            <UIcon :name="row.original.icon" class="w-3.5 h-3.5" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-text-main block truncate text-xs" :title="row.original.nombre">
                {{ row.original.nombre }}
              </span>
              <UBadge
                v-if="row.original.esSistema"
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
            <span class="text-[11px] text-text-muted block truncate font-mono" :title="row.original.nombreConjunto">
              {{ row.original.nombreConjunto }}
            </span>
          </div>
        </div>
      </template>

      <!-- 2. Entidad Destino -->
      <template #entity-cell="{ row }">
        <div class="min-w-28">
          <UBadge
            v-if="row.original.entidadDestino === 'aeropuertos'"
            color="primary"
            variant="subtle"
            size="xs"
            class="gap-1 font-mono text-[10px]"
          >
            <UIcon name="i-lucide-map-pin" class="w-3 h-3" />
            Aeropuertos
          </UBadge>
          <UBadge
            v-else-if="row.original.entidadDestino === 'rutas'"
            color="info"
            variant="subtle"
            size="xs"
            class="gap-1 font-mono text-[10px]"
          >
            <UIcon name="i-lucide-route" class="w-3 h-3" />
            Rutas
          </UBadge>
          <UBadge
            v-else
            color="secondary"
            variant="subtle"
            size="xs"
            class="gap-1 font-mono text-[10px]"
          >
            <UIcon name="i-lucide-timer" class="w-3 h-3" />
            OTP-15
          </UBadge>
        </div>
      </template>

      <!-- 3. Endpoint & Conexión -->
      <template #endpoint-cell="{ row }">
        <div class="min-w-36 max-w-48 space-y-1 py-1">
          <div class="flex items-center gap-1.5">
            <UBadge
              color="neutral"
              variant="subtle"
              size="xs"
              class="font-mono font-bold text-[9px] px-1 py-0"
            >
              {{ row.original.conexion?.metodoHttp || "GET" }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="outline"
              size="xs"
              class="font-mono uppercase text-[9px] px-1 py-0"
            >
              {{ row.original.conexion?.formatoDatos || "CSV" }}
            </UBadge>
          </div>

          <div class="flex items-center gap-1">
            <span
              class="font-mono text-[11px] text-text-dim truncate max-w-32 sm:max-w-36 block"
              :title="row.original.conexion?.urlEndpoint"
            >
              {{ row.original.conexion?.urlEndpoint || "https://..." }}
            </span>
            <UButton
              v-if="row.original.conexion?.urlEndpoint"
              size="xs"
              variant="ghost"
              color="neutral"
              :icon="
                copiedEndpointId === row.original.id
                  ? 'i-lucide-check'
                  : 'i-lucide-copy'
              "
              class="cursor-pointer shrink-0 p-0.5"
              @click="
                copyUrl(
                  row.original.id,
                  row.original.conexion?.urlEndpoint || '',
                )
              "
            />
          </div>
        </div>
      </template>

      <!-- 4. Frecuencia -->
      <template #schedule-cell="{ row }">
        <div class="min-w-28 space-y-0.5">
          <span class="text-xs font-semibold text-text-main block truncate">
            {{ row.original.scheduleDescription }}
          </span>
          <span
            v-if="row.original.configuracionProgramacion?.expresionCron"
            class="font-mono text-[10px] text-text-dim block truncate"
          >
            {{ row.original.configuracionProgramacion.expresionCron }}
          </span>
        </div>
      </template>

      <!-- 5. Estado & Switch -->
      <template #estado-cell="{ row }">
        <div class="flex items-center gap-1.5 min-w-24">
          <UBadge
            v-if="row.original.estado === 'success'"
            color="success"
            variant="subtle"
            size="xs"
            class="font-mono text-[10px] gap-1 px-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Al día
          </UBadge>
          <UBadge
            v-else-if="row.original.estado === 'running'"
            color="info"
            variant="subtle"
            size="xs"
            class="font-mono text-[10px] gap-1 px-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
            Activo
          </UBadge>
          <UBadge
            v-else-if="row.original.estado === 'pausado'"
            color="warning"
            variant="subtle"
            size="xs"
            class="font-mono text-[10px] gap-1 px-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pausado
          </UBadge>
          <UBadge
            v-else-if="row.original.estado === 'error'"
            color="error"
            variant="subtle"
            size="xs"
            class="font-mono text-[10px] gap-1 px-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Error
          </UBadge>
          <UBadge
            v-else
            color="neutral"
            variant="subtle"
            size="xs"
            class="font-mono text-[10px] px-1.5"
          >
            En espera
          </UBadge>
        </div>
      </template>

      <!-- 6. Acciones -->
      <template #actions-cell="{ row }">
        <div class="flex items-center gap-1 min-w-32 justify-end whitespace-nowrap">
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
              row.original.estado === 'pausado'
                ? 'Reanudar Servicio'
                : 'Pausar Servicio'
            "
          >
            <UButton
              size="xs"
              variant="ghost"
              :color="row.original.estado === 'pausado' ? 'success' : 'warning'"
              :icon="
                row.original.estado === 'pausado'
                  ? 'i-lucide-check-circle'
                  : 'i-lucide-pause'
              "
              class="cursor-pointer"
              @click="emit('toggle-estado', row.original)"
            />
          </UTooltip>

          <UTooltip
            :text="
              row.original.esSistema
                ? 'Los servicios del sistema no se pueden eliminar'
                : 'Eliminar Servicio'
            "
          >
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              :disabled="row.original.esSistema"
              class="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              @click="emit('delete', row.original)"
            />
          </UTooltip>
        </div>
      </template>
    </UTable>
  </div>
</template>

<style scoped>
:deep(table) {
  border-collapse: separate;
  border-spacing: 0;
}

:deep(th:last-child) {
  position: sticky;
  right: 0;
  z-index: 20;
  background-color: var(--color-surface-card);
  border-left: 1px solid var(--color-border-subtle);
  box-shadow: -4px 0 8px -2px rgba(0, 0, 0, 0.08);
}

:deep(td:last-child) {
  position: sticky;
  right: 0;
  z-index: 10;
  background-color: var(--color-surface-card);
  border-left: 1px solid var(--color-border-subtle);
  box-shadow: -4px 0 8px -2px rgba(0, 0, 0, 0.08);
}

:deep(tr:hover td:last-child) {
  background-color: var(--color-surface-accent);
}
</style>
