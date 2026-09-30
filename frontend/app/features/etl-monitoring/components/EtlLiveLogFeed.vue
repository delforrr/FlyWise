<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import type { EtlLogEntry, PipelineId } from "../types/etl";

interface Props {
  logs: EtlLogEntry[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "clear-logs"): void;
}>();

const levelFilter = ref<"all" | "success" | "warn_error">("all");
const selectedSource = ref<"all" | PipelineId>("all");
const searchQuery = ref("");
const isAutoScroll = ref(true);
const copiedId = ref<string | null>(null);
const expandedLogs = ref<Record<string, boolean>>({});
const logContainerRef = ref<HTMLElement | null>(null);

const sourceOptions = [
  { label: "Todas las fuentes", value: "all" },
  { label: "OurAirports", value: "ourairports" },
  { label: "OpenFlights", value: "openflights" },
  { label: "BTS TranStats", value: "bts-transtats" },
  { label: "ANAC Argentina", value: "anac-arg" },
];

function toggleExpand(id: string) {
  expandedLogs.value[id] = !expandedLogs.value[id];
}

async function copyLogDetail(id: string, text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    copiedId.value = id;
    setTimeout(() => {
      if (copiedId.value === id) {
        copiedId.value = null;
      }
    }, 1800);
  }
}

function exportLogsAsJson() {
  if (typeof window === "undefined") return;
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(filteredLogs.value, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `flywise-etl-audit-logs-${Date.now()}.json`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

const filteredLogs = computed(() => {
  return props.logs.filter((log) => {
    // 1. Filtro por nivel
    if (levelFilter.value === "success" && log.level !== "success") {
      return false;
    }
    if (
      levelFilter.value === "warn_error" &&
      log.level !== "warn" &&
      log.level !== "error"
    ) {
      return false;
    }

    // 2. Filtro por fuente
    if (
      selectedSource.value !== "all" &&
      log.pipelineId !== selectedSource.value
    ) {
      return false;
    }

    // 3. Filtro por búsqueda de texto
    if (searchQuery.value.trim() !== "") {
      const q = searchQuery.value.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchPipe = log.pipelineName.toLowerCase().includes(q);
      const matchDetail = log.detail
        ? log.detail.toLowerCase().includes(q)
        : false;
      if (!matchMsg && !matchPipe && !matchDetail) return false;
    }

    return true;
  });
});

// Autoscroll hacia el tope al ingresar nuevos logs si isAutoScroll está activo
watch(
  () => props.logs.length,
  () => {
    if (isAutoScroll.value && logContainerRef.value) {
      nextTick(() => {
        logContainerRef.value?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  },
);
</script>

<template>
  <div
    class="rounded-xl border border-border-subtle bg-surface-card overflow-hidden shadow-xs"
  >
    <!-- Barra superior del visor de eventos -->
    <div
      class="p-3.5 sm:p-4 border-b border-border-subtle flex flex-col gap-3 bg-surface-accent/40"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-terminal" class="w-4 h-4 text-text-muted" />
          <h3
            class="text-sm font-bold font-mono tracking-tight text-text-main uppercase"
          >
            Registro de Eventos y Auditoría en Vivo
          </h3>
          <span class="text-xs text-text-muted font-mono tabular-nums">
            ({{ filteredLogs.length }} eventos)
          </span>
        </div>

        <div
          class="flex items-center gap-2 self-start sm:self-auto font-mono text-xs"
        >
          <UButton
            size="xs"
            :variant="isAutoScroll ? 'subtle' : 'outline'"
            :color="isAutoScroll ? 'primary' : 'neutral'"
            class="text-[11px] font-semibold cursor-pointer"
            title="Mantener la vista enfocada en el flujo más reciente"
            @click="isAutoScroll = !isAutoScroll"
          >
            <template #leading>
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="
                  isAutoScroll ? 'bg-primary animate-pulse' : 'bg-neutral-400'
                "
              />
            </template>
            Autoscroll
          </UButton>

          <!-- Exportar JSON -->
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-download"
            class="text-[11px] font-medium cursor-pointer border-border-subtle"
            title="Descargar eventos visibles en formato JSON"
            @click="exportLogsAsJson"
          >
            Exportar
          </UButton>

          <!-- Botón Limpiar -->
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-trash-2"
            class="text-[11px] cursor-pointer text-text-muted hover:text-rose-500"
            title="Limpiar registro de eventos"
            @click="emit('clear-logs')"
          >
            Limpiar
          </UButton>
        </div>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div
        class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 text-xs"
      >
        <div class="flex items-center gap-2 flex-wrap font-mono">
          <!-- Filtros de nivel -->
          <div
            class="inline-flex p-0.5 rounded-lg border border-border-subtle bg-surface-card text-[11px]"
          >
            <button
              type="button"
              class="px-2.5 py-0.5 rounded-md cursor-pointer transition-colors"
              :class="
                levelFilter === 'all'
                  ? 'bg-surface-accent text-text-main font-bold'
                  : 'text-text-muted hover:text-text-main'
              "
              @click="levelFilter = 'all'"
            >
              Todos
            </button>
            <button
              type="button"
              class="px-2.5 py-0.5 rounded-md cursor-pointer transition-colors"
              :class="
                levelFilter === 'success'
                  ? 'bg-surface-accent text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-text-muted hover:text-text-main'
              "
              @click="levelFilter = 'success'"
            >
              Éxito
            </button>
            <button
              type="button"
              class="px-2.5 py-0.5 rounded-md cursor-pointer transition-colors"
              :class="
                levelFilter === 'warn_error'
                  ? 'bg-surface-accent text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-text-muted hover:text-text-main'
              "
              @click="levelFilter = 'warn_error'"
            >
              Incidencias
            </button>
          </div>

          <!-- Selector de Fuente de Datos -->
          <USelect
            v-model="selectedSource"
            :items="sourceOptions"
            size="xs"
            class="w-44 font-mono text-[11px]"
          />
        </div>

        <!-- Buscador de Texto en Logs -->
        <div class="w-full sm:w-56">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Filtrar eventos..."
            size="xs"
            class="w-full rounded-lg text-xs"
          />
        </div>
      </div>
    </div>

    <!-- Lista de eventos con scroll -->
    <div
      ref="logContainerRef"
      class="divide-y divide-border-subtle/50 max-h-96 overflow-y-auto font-sans"
    >
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="p-3 text-xs hover:bg-surface-accent/30 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Icono de estado -->
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
              <span class="font-semibold font-mono text-text-main">
                {{ log.pipelineName }}
              </span>
              <span
                class="font-mono tabular-nums text-[11px] text-text-dim shrink-0"
              >
                {{ log.timestamp }}
              </span>
            </div>
            <p class="text-text-muted mt-0.5 leading-relaxed">
              {{ log.message }}
            </p>

            <!-- Detalle técnico -->
            <UCollapsible
              v-if="log.detail"
              v-model:open="expandedLogs[log.id]"
              class="mt-1.5"
            >
              <template #default="{ open }">
                <div class="flex items-center gap-3">
                  <UButton
                    variant="link"
                    color="primary"
                    size="xs"
                    :icon="
                      open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
                    "
                    trailing
                    :label="
                      open ? 'Ocultar detalle técnico' : 'Ver detalle técnico'
                    "
                    class="p-0 font-mono text-[11px] cursor-pointer"
                    @click="toggleExpand(log.id)"
                  />

                  <UButton
                    v-if="open"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :icon="
                      copiedId === log.id ? 'i-lucide-check' : 'i-lucide-copy'
                    "
                    :label="copiedId === log.id ? 'Copiado!' : 'Copiar'"
                    class="text-[11px] font-mono cursor-pointer p-1"
                    :class="{ 'text-emerald-500': copiedId === log.id }"
                    title="Copiar payload técnico al portapapeles"
                    @click="copyLogDetail(log.id, log.detail)"
                  />
                </div>
              </template>

              <template #content>
                <div
                  class="mt-1 p-2.5 rounded-lg bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim whitespace-pre-wrap break-all leading-relaxed shadow-inner"
                >
                  {{ log.detail }}
                </div>
              </template>
            </UCollapsible>
          </div>
        </div>
      </div>

      <!-- Estado vacío -->
      <div v-if="filteredLogs.length === 0" class="p-8">
        <UEmpty
          icon="i-lucide-inbox"
          title="Sin eventos registrados"
          description="No hay eventos que coincidan con los criterios de búsqueda o filtro seleccionados."
          variant="subtle"
        />
      </div>
    </div>
  </div>
</template>
