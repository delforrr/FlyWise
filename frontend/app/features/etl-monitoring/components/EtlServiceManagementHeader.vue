<script setup lang="ts">
interface Props {
  stats: {
    total: number;
    systemCount: number;
    customCount: number;
    activeCount: number;
    errorCount: number;
  };
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "create-service"): void;
}>();
</script>

<template>
  <div class="space-y-4">
    <!-- Fila Superior: Título, Descripción y Botón Primario -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-xl sm:text-2xl font-bold font-display text-text-main tracking-tight">
            Gestión de Servicios y Pipelines ETL
          </h1>
          <UBadge color="primary" variant="subtle" size="sm" class="font-mono text-xs">
            Configuración
          </UBadge>
        </div>
        <p class="text-xs text-text-muted mt-1 max-w-2xl">
          Administra las fuentes oficiales de aviación y registra endpoints personalizados
          con soporte de streaming HTTP, mapeo de esquemas y procesamiento por lotes en BullMQ.
        </p>
      </div>

      <div class="flex items-center gap-2.5 shrink-0">
        <UButton
          to="/admin"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-activity"
          class="text-xs font-semibold cursor-pointer"
        >
          Consola en Vivo
        </UButton>

        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-plus"
          class="text-xs font-bold cursor-pointer text-white shadow-xs"
          @click="emit('create-service')"
        >
          Nuevo Servicio de Ingesta
        </UButton>
      </div>
    </div>

    <!-- Chips KPI de Inventario de Servicios -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
      <div
        class="p-3 rounded-xl border border-border-subtle bg-surface-card shadow-xs"
      >
        <span class="text-[11px] text-text-muted font-medium block">
          Total Pipelines
        </span>
        <div class="flex items-baseline gap-1.5 mt-1">
          <span class="text-lg font-bold font-mono text-text-main tabular-nums">
            {{ stats.total }}
          </span>
          <span class="text-[10px] text-text-dim font-mono">fuentes</span>
        </div>
      </div>

      <div
        class="p-3 rounded-xl border border-border-subtle bg-surface-card shadow-xs"
      >
        <span class="text-[11px] text-text-muted font-medium block">
          Fuentes Nativas
        </span>
        <div class="flex items-baseline gap-1.5 mt-1">
          <span class="text-lg font-bold font-mono text-primary tabular-nums">
            {{ stats.systemCount }}
          </span>
          <span class="text-[10px] text-text-dim font-mono">oficiales</span>
        </div>
      </div>

      <div
        class="p-3 rounded-xl border border-border-subtle bg-surface-card shadow-xs"
      >
        <span class="text-[11px] text-text-muted font-medium block">
          Personalizados
        </span>
        <div class="flex items-baseline gap-1.5 mt-1">
          <span class="text-lg font-bold font-mono text-secondary tabular-nums">
            {{ stats.customCount }}
          </span>
          <span class="text-[10px] text-text-dim font-mono">activos</span>
        </div>
      </div>

      <div
        class="p-3 rounded-xl border border-border-subtle bg-surface-card shadow-xs"
      >
        <span class="text-[11px] text-text-muted font-medium block">
          En Ejecución / Al día
        </span>
        <div class="flex items-baseline gap-1.5 mt-1">
          <span class="text-lg font-bold font-mono text-emerald-500 tabular-nums">
            {{ stats.activeCount }}
          </span>
          <span class="text-[10px] text-text-dim font-mono">operativos</span>
        </div>
      </div>

      <div
        class="p-3 rounded-xl border border-border-subtle bg-surface-card shadow-xs"
      >
        <span class="text-[11px] text-text-muted font-medium block">
          Incidencias / Error
        </span>
        <div class="flex items-baseline gap-1.5 mt-1">
          <span
            class="text-lg font-bold font-mono tabular-nums"
            :class="stats.errorCount > 0 ? 'text-rose-500' : 'text-text-dim'"
          >
            {{ stats.errorCount }}
          </span>
          <span class="text-[10px] text-text-dim font-mono">errores</span>
        </div>
      </div>
    </div>
  </div>
</template>
