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
    <div class="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-accent/40">
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
            :class="levelFilter === 'all' ? 'bg-surface-accent text-text-main font-semibold' : 'text-text-muted hover:text-text-main'"
            @click="levelFilter = 'all'"
          >
            Todos
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            :class="levelFilter === 'success' ? 'bg-surface-accent text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-text-muted hover:text-text-main'"
            @click="levelFilter = 'success'"
          >
            Completados
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            :class="levelFilter === 'warn_error' ? 'bg-surface-accent text-amber-700 dark:text-amber-400 font-semibold' : 'text-text-muted hover:text-text-main'"
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
          <!-- Icono de estado -->
          <div class="mt-0.5 flex-shrink-0">
            <span
              v-if="log.level === 'success'"
              class="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            >
              <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
            </span>
            <span
              v-else-if="log.level === 'warn'"
              class="w-5 h-5 rounded flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            >
              <UIcon name="i-lucide-alert-triangle" class="w-3.5 h-3.5" />
            </span>
            <span
              v-else-if="log.level === 'error'"
              class="w-5 h-5 rounded flex items-center justify-center bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            >
              <UIcon name="i-lucide-x-circle" class="w-3.5 h-3.5" />
            </span>
            <span
              v-else
              class="w-5 h-5 rounded flex items-center justify-center bg-surface-accent text-primary border border-border-subtle"
            >
              <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />
            </span>
          </div>

          <!-- Contenido del log -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-semibold text-text-main">
                {{ log.pipelineName }}
              </span>
              <span class="font-mono text-[11px] text-text-dim flex-shrink-0">
                {{ log.timestamp }}
              </span>
            </div>
            <p class="text-text-muted mt-0.5 leading-relaxed">
              {{ log.message }}
            </p>

            <!-- Detalle técnico colapsable -->
            <div v-if="log.detail" class="mt-1.5">
              <button
                type="button"
                class="text-[11px] text-primary hover:underline font-mono inline-flex items-center gap-1 cursor-pointer"
                @click="toggleExpand(log.id)"
              >
                <span>{{ expandedLogs[log.id] ? 'Ocultar detalle técnico' : 'Ver detalle técnico' }}</span>
                <UIcon
                  :name="expandedLogs[log.id] ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="w-3 h-3"
                />
              </button>

              <div
                v-if="expandedLogs[log.id]"
                class="mt-1 p-2 rounded bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim whitespace-pre-wrap break-all"
              >
                {{ log.detail }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Estado vacío si no hay logs -->
      <div v-if="filteredLogs.length === 0" class="p-8 text-center text-text-muted text-xs">
        No hay eventos registrados en este momento.
      </div>
    </div>
  </div>
</template>
