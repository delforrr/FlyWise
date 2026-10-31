<script setup lang="ts">
import { ref, computed } from "vue";
import type { TargetEntity, FieldMappingRule } from "../types/etl";
import { TARGET_FIELDS_CATALOG } from "../types/etl";

interface Props {
  entidadDestino: TargetEntity;
  detectedColumns: string[];
  modelValue: FieldMappingRule[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: FieldMappingRule[]): void;
}>();

const currentTargetFields = computed(() => {
  return TARGET_FIELDS_CATALOG[props.entidadDestino] || [];
});

const totalRequiredCount = computed(() => currentTargetFields.value.filter(f => f.required).length);

const mappedRequiredCount = computed(() => {
  return currentTargetFields.value.filter((f) => {
    if (!f.required) return false;
    const rule = props.modelValue.find((m) => m.campoDestino === f.key);
    return !!rule && !!rule.columnaOrigen && rule.columnaOrigen.trim() !== "";
  }).length;
});

const isMappingComplete = computed(() => {
  return mappedRequiredCount.value === totalRequiredCount.value;
});

const transformOptions = [
  { label: "Sin transformación", value: "none" },
  { label: "A Mayúsculas (UPPERCASE)", value: "uppercase" },
  { label: "Limpiar espacios (Trim)", value: "trim" },
  { label: "Convertir a Número", value: "to_number" },
  { label: "Convertir a Booleano", value: "to_boolean" },
];

function getMappingForField(targetKey: string): FieldMappingRule {
  const existing = props.modelValue.find((m) => m.campoDestino === targetKey);
  if (existing) return existing;
  return {
    columnaOrigen: "",
    campoDestino: targetKey,
    transform: "none",
    required: currentTargetFields.value.find((f) => f.key === targetKey)?.required || false,
  };
}

function updateRule(targetKey: string, fieldPatch: Partial<FieldMappingRule>) {
  const next = [...props.modelValue];
  const idx = next.findIndex((m) => m.campoDestino === targetKey);
  const targetDef = currentTargetFields.value.find((f) => f.key === targetKey);

  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      ...fieldPatch,
      required: targetDef?.required || false,
    } as FieldMappingRule;
  } else {
    next.push({
      columnaOrigen: "",
      campoDestino: targetKey,
      transform: "none",
      required: targetDef?.required || false,
      ...fieldPatch,
    });
  }

  emit("update:modelValue", next);
}

// Autodetección heurística de nombres similares
function autoDetectMapping() {
  if (props.detectedColumns.length === 0) return;

  const next: FieldMappingRule[] = [];

  for (const target of currentTargetFields.value) {
    const targetKeyLower = target.key.toLowerCase();
    // Buscar coincidencia exacta o parcial
    const match = props.detectedColumns.find((col) => {
      const colLower = col.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        colLower === targetKeyLower ||
        colLower.includes(targetKeyLower) ||
        targetKeyLower.includes(colLower)
      );
    });

    if (match) {
      next.push({
        columnaOrigen: match,
        campoDestino: target.key,
        transform: target.type === "number" ? "to_number" : "none",
        required: target.required,
      });
    }
  }

  emit("update:modelValue", next);
}
</script>

<template>
  <div class="space-y-4 text-xs">
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-subtle"
    >
      <div>
        <h4 class="font-bold text-text-main text-xs">
          Esquema de Mapeo Semántico
        </h4>
        <p class="text-[11px] text-text-muted">
          Asigna las columnas del endpoint a las propiedades del modelo FlyWise.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UBadge
          v-if="isMappingComplete"
          color="success"
          variant="subtle"
          size="sm"
          class="font-mono text-[10px] gap-1 shrink-0"
        >
          <UIcon name="i-lucide-check-circle" class="w-3.5 h-3.5" />
          Obligatorios: {{ mappedRequiredCount }}/{{ totalRequiredCount }}
        </UBadge>
        <UBadge
          v-else
          color="error"
          variant="subtle"
          size="sm"
          class="font-mono text-[10px] gap-1 shrink-0"
        >
          <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5" />
          Obligatorios: {{ mappedRequiredCount }}/{{ totalRequiredCount }} (Faltan {{ totalRequiredCount - mappedRequiredCount }})
        </UBadge>

        <UButton
          v-if="detectedColumns.length > 0"
          size="xs"
          variant="outline"
          color="primary"
          icon="i-lucide-sparkles"
          class="cursor-pointer font-bold shrink-0"
          @click="autoDetectMapping"
        >
          Mapeo Automático
        </UButton>
      </div>
    </div>

    <!-- Lista de Campos del Modelo Destino -->
    <div class="space-y-2.5">
      <div
        v-for="target in currentTargetFields"
        :key="target.key"
        class="p-3 rounded-xl border transition-colors space-y-2"
        :class="[
          target.required && (!getMappingForField(target.key).columnaOrigen || !getMappingForField(target.key).columnaOrigen.trim())
            ? 'border-rose-500/50 bg-rose-500/5 hover:border-rose-500/70'
            : 'border-border-subtle bg-surface-card hover:border-primary/40'
        ]"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-text-main text-xs">
              {{ target.label }}
            </span>
            <span class="font-mono text-[10px] text-text-dim">
              ({{ target.key }})
            </span>
            <UBadge
              v-if="target.required"
              color="error"
              variant="subtle"
              size="xs"
              class="font-mono text-[10px]"
            >
              Requerido *
            </UBadge>
            <span
              v-if="target.required && (!getMappingForField(target.key).columnaOrigen || !getMappingForField(target.key).columnaOrigen.trim())"
              class="text-[10px] font-medium text-rose-500 ml-1 hidden sm:inline"
            >
              (Sin asignar)
            </span>
          </div>
          <span class="text-[10px] font-mono text-text-muted">
            Tipo: {{ target.type }}
          </span>
        </div>

        <p class="text-[11px] text-text-muted">
          {{ target.descripcion }}
        </p>

        <!-- Controles de Mapeo -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <!-- Columna Origen -->
          <div>
            <label class="block text-[10px] font-semibold text-text-muted mb-1">
              Columna en Fuente / Endpoint:
            </label>
            <UInput
              v-if="detectedColumns.length === 0"
              :model-value="getMappingForField(target.key).columnaOrigen"
              placeholder="Ej: ident, origin_iata, etc."
              size="sm"
              class="w-full font-mono text-xs"
              @update:model-value="
                (val) => updateRule(target.key, { columnaOrigen: String(val) })
              "
            />
            <select
              v-else
              :value="getMappingForField(target.key).columnaOrigen"
              class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-primary focus:outline-none"
              @change="
                (e) =>
                  updateRule(target.key, {
                    columnaOrigen: (e.target as HTMLSelectElement).value,
                  })
              "
            >
              <option value="">-- Sin asignar --</option>
              <option
                v-for="col in detectedColumns"
                :key="col"
                :value="col"
              >
                {{ col }}
              </option>
            </select>
          </div>

          <!-- Transformación -->
          <div>
            <label class="block text-[10px] font-semibold text-text-muted mb-1">
              Transformación / Normalización:
            </label>
            <select
              :value="getMappingForField(target.key).transform || 'none'"
              class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              @change="
                (e) =>
                  updateRule(target.key, {
                    transform: (e.target as HTMLSelectElement).value as FieldMappingRule['transform'],
                  })
              "
            >
              <option
                v-for="opt in transformOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
