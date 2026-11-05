<script setup lang="ts">
import { ref } from "vue";
import type {
  PipelineConnectionConfig,
  ProbeEndpointResult,
} from "../types/etl";

interface Props {
  conexion: PipelineConnectionConfig;
  probeResult: ProbeEndpointResult | null;
  isLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "test-conexion"): void;
  (e: "apply-detected-columns", columns: string[]): void;
}>();

const isCopied = ref(false);

async function copyEndpointUrl() {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(props.conexion.urlEndpoint);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 1800);
  }
}
</script>

<template>
  <div
    class="rounded-xl border border-border-subtle bg-surface-accent/40 p-4 space-y-3.5"
  >
    <!-- Cabecera de Verificación -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0"
        >
          <UIcon name="i-lucide-activity" class="w-4 h-4" />
        </div>
        <div>
          <span class="font-bold text-xs text-text-main block">
            Verificación Activa del Endpoint
          </span>
          <span class="text-[11px] text-text-muted">
            Valida la disponibilidad, latencia y formato antes de guardar.
          </span>
        </div>
      </div>

      <UButton
        size="sm"
        color="primary"
        variant="solid"
        :loading="isLoading"
        icon="i-lucide-zap"
        class="cursor-pointer font-bold text-xs text-white shrink-0"
        @click="emit('test-conexion')"
      >
        {{ isLoading ? "Verificando..." : "Probar Conexión" }}
      </UButton>
    </div>

    <!-- Indicador de URL a Consultar -->
    <div
      class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-card border border-border-subtle font-mono text-[11px]"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UBadge color="neutral" variant="outline" size="xs" class="font-bold">
          {{ conexion.metodoHttp }}
        </UBadge>
        <span
          class="text-text-main truncate"
          :title="conexion.urlEndpoint || 'Sin endpoint configurado'"
        >
          {{ conexion.urlEndpoint || "https://..." }}
        </span>
      </div>

      <UButton
        v-if="conexion.urlEndpoint"
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="isCopied ? 'i-lucide-check' : 'i-lucide-copy'"
        :title="isCopied ? 'Copiado' : 'Copiar URL'"
        class="shrink-0 cursor-pointer"
        @click="copyEndpointUrl"
      />
    </div>

    <!-- Resultados del Test -->
    <div v-if="probeResult" class="space-y-3 pt-1">
      <!-- Caso Exitoso (200 OK) -->
      <div
        v-if="probeResult.success"
        class="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2.5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-check-circle-2"
              class="w-4 h-4 text-emerald-500 shrink-0"
            />
            <span class="font-bold text-xs text-emerald-600 dark:text-emerald-400">
              Conexión Exitosa ({{ probeResult.statusCode }} OK)
            </span>
          </div>

          <div
            class="flex items-center gap-3 font-mono text-[11px] text-text-muted"
          >
            <span>
              Latencia:
              <strong class="text-text-main tabular-nums">
                {{ probeResult.latencyMs }}ms
              </strong>
            </span>
            <span>&bull;</span>
            <span>
              Tipo:
              <strong class="text-text-main">
                {{ probeResult.contentType.split(";")[0] }}
              </strong>
            </span>
            <span v-if="probeResult.estimatedTotalSize">&bull;</span>
            <span v-if="probeResult.estimatedTotalSize">
              Estimado:
              <strong class="text-text-main">
                {{ probeResult.estimatedTotalSize }}
              </strong>
            </span>
          </div>
        </div>

        <!-- Columnas Detectadas con Botón de Auto-aplicar al Mapeo -->
        <div
          v-if="probeResult.detectedColumns.length > 0"
          class="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] text-text-muted">
              Columnas detectadas:
            </span>
            <UBadge
              v-for="col in probeResult.detectedColumns"
              :key="col"
              color="neutral"
              variant="subtle"
              size="xs"
              class="font-mono text-[10px]"
            >
              {{ col }}
            </UBadge>
          </div>

          <UButton
            size="xs"
            color="success"
            variant="ghost"
            icon="i-lucide-wand-2"
            class="cursor-pointer font-bold text-[11px] shrink-0"
            @click="emit('apply-detected-columns', probeResult.detectedColumns)"
          >
            Vincular al Esquema
          </UButton>
        </div>
      </div>

      <!-- Caso Fallido / Error -->
      <div
        v-else
        class="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1.5"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-alert-triangle"
            class="w-4 h-4 text-rose-500 shrink-0"
          />
          <span class="font-bold text-xs text-rose-600 dark:text-rose-400">
            Fallo en la conexión (HTTP {{ probeResult.statusCode }})
          </span>
        </div>
        <p class="text-xs text-text-muted pl-6">
          {{ probeResult.mensajeError || "No se pudo establecer comunicación con el endpoint." }}
        </p>
      </div>

      <!-- Muestra de Datos Crudos (Preview) -->
      <div
        v-if="probeResult.sampleRows && probeResult.sampleRows.length > 0"
        class="space-y-1.5"
      >
        <span class="text-[11px] font-semibold text-text-muted block">
          Muestra de primeros registros (Head Sample):
        </span>
        <div
          class="rounded-lg border border-border-subtle bg-surface-card overflow-x-auto"
        >
          <table class="w-full text-left font-mono text-[11px]">
            <thead
              class="bg-surface-accent text-text-dim border-b border-border-subtle"
            >
              <tr>
                <th
                  v-for="(val, key) in probeResult.sampleRows[0]"
                  :key="key"
                  class="px-2.5 py-1.5 font-medium whitespace-nowrap"
                >
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle/50 text-text-main">
              <tr
                v-for="(row, idx) in probeResult.sampleRows"
                :key="idx"
                class="hover:bg-surface-accent/50"
              >
                <td
                  v-for="(val, key) in row"
                  :key="key"
                  class="px-2.5 py-1.5 whitespace-nowrap"
                >
                  {{ val }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
