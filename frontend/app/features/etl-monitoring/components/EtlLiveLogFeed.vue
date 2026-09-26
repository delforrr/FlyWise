<script setup lang="ts">
import { ref, computed } from 'vue';
import type { EtlLogEntry } from '../types/etl';

interface Props {
  logs: EtlLogEntry[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'clear-logs'): void;
}>();

const levelFilter = ref<'all' | 'success' | 'warn_error'>('all');
const expandedLogs = ref<Record<string, boolean>>({});

function toggleExpand(id: string) {
  expandedLogs.value[id] = !expandedLogs.value[id];
}

const filteredLogs = computed(() => {
  return props.logs.filter((log) => {
    if (levelFilter.value === 'success') {
      return log.level === 'success';
    }
    if (levelFilter.value === 'warn_error') {
      return log.level === 'warn' || log.level === 'error';
    }
    return true;
  });
});
</script>

<template>
  <div class="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
    <!-- Barra superior del visor de eventos -->
    <div
      class="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-accent/40"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-terminal" class="w-4 h-4 text-text-muted" />
        <h3 class="text-sm font-bold text-text-main">
          Registro de Eventos y Auditoría en Vivo
        </h3>
        <span class="text-xs text-text-muted font-mono">
          ({{ filteredLogs.length }} eventos)
        </span>
      </div>

      <div class="flex items-center gap-2">
        <!-- Filtros de nivel -->
        <div class="inline-flex p-0.5 rounded-lg border border-border-subtle bg-surface-card text-xs">
          <button
            type="button"
            class="px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            :class="
              levelFilter === 'all'
                ? 'bg-surface-accent text-text-main font-semibold'
                : 'text-text-muted hover:text-text-main'
            "
            @click="levelFilter = 'all'"
          >
            Todos
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            :class="
              levelFilter === 'success'
                ? 'bg-surface-accent text-emerald-700 dark:text-emerald-400 font-semibold'
                : 'text-text-muted hover:text-text-main'
            "
            @click="levelFilter = 'success'"
          >
            Completados
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            :class="
              levelFilter === 'warn_error'
                ? 'bg-surface-accent text-amber-700 dark:text-amber-400 font-semibold'
                : 'text-text-muted hover:text-text-main'
            "
            @click="levelFilter = 'warn_error'"
          >
            Incidencias
          </button>
        </div>

        <!-- Botón Limpiar -->
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-trash-2"
          class="text-xs cursor-pointer"
          @click="emit('clear-logs')"
        >
          Limpiar
        </UButton>
      </div>
    </div>

    <!-- Lista de eventos con scroll -->
    <div class="divide-y divide-border-subtle/50 max-h-96 overflow-y-auto font-sans">
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="p-3 text-xs hover:bg-surface-accent/30 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Icono de estado con UBadge -->
          <div class="mt-0.5 shrink-0">
            <UBadge
              v-if="log.level === 'success'"
              color="success"
              variant="subtle"
              size="sm"
              icon="i-lucide-check"
            />
            <UBadge
              v-else-if="log.level === 'warn'"
              color="warning"
              variant="subtle"
              size="sm"
              icon="i-lucide-alert-triangle"
            />
            <UBadge
              v-else-if="log.level === 'error'"
              color="error"
              variant="subtle"
              size="sm"
              icon="i-lucide-x-circle"
            />
            <UBadge
              v-else
              color="info"
              variant="subtle"
              size="sm"
              icon="i-lucide-info"
            />
          </div>

          <!-- Contenido del log -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-semibold text-text-main">
                {{ log.pipelineName }}
              </span>
              <span class="font-mono text-[11px] text-text-dim shrink-0">
                {{ log.timestamp }}
              </span>
            </div>
            <p class="text-text-muted mt-0.5 leading-relaxed">
              {{ log.message }}
            </p>

            <!-- Detalle técnico colapsable -->
            <UCollapsible v-if="log.detail" v-model:open="expandedLogs[log.id]" class="mt-1.5">
              <template #default="{ open }">
                <button
                  type="button"
                  class="text-[11px] text-primary hover:underline font-mono inline-flex items-center gap-1 cursor-pointer"
                  @click="toggleExpand(log.id)"
                >
                  <span>{{ open ? 'Ocultar detalle técnico' : 'Ver detalle técnico' }}</span>
                  <UIcon
                    :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="w-3 h-3"
                  />
                </button>
              </template>

              <template #content>
                <div
                  class="mt-1 p-2 rounded bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim whitespace-pre-wrap break-all"
                >
                  {{ log.detail }}
                </div>
              </template>
            </UCollapsible>
          </div>
        </div>
      </div>

      <!-- Estado vacío utilizando Nuxt UI UEmpty -->
      <div v-if="filteredLogs.length === 0" class="p-8">
        <UEmpty
          icon="i-lucide-inbox"
          title="Sin eventos registrados"
          description="No hay eventos en este nivel de filtro actualmente."
          variant="subtle"
        />
      </div>
    </div>
  </div>
</template>
