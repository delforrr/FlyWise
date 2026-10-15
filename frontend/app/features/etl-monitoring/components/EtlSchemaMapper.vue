<script setup lang="ts">
import { ref, computed } from "vue";
import type { TargetEntity, FieldMappingRule } from "../types/etl";

interface Props {
  targetEntity: TargetEntity;
  detectedColumns: string[];
  modelValue: FieldMappingRule[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: FieldMappingRule[]): void;
}>();

// Definición de campos canónicos según modelo en PostGIS / FlyWise
interface TargetFieldDef {
  key: string;
  label: string;
  description: string;
  required: boolean;
  type: string;
}

const targetFieldsCatalog: Record<TargetEntity, TargetFieldDef[]> = {
  airports: [
    {
      key: "icaoCode",
      label: "Código ICAO",
      description: "Identificador oficial de 4 letras (ej. SAEZ, KJFK).",
      required: true,
      type: "string",
    },
    {
      key: "iataCode",
      label: "Código IATA",
      description: "Identificador comercial de 3 letras (ej. EZE, JFK).",
      required: false,
      type: "string",
    },
    {
      key: "name",
      label: "Nombre del Aeropuerto",
      description: "Denominación pública oficial.",
      required: true,
      type: "string",
    },
    {
      key: "latitude",
      label: "Latitud (SRID 4326)",
      description: "Coordenada decimal [-90, 90].",
      required: true,
      type: "number",
    },
    {
      key: "longitude",
      label: "Longitud (SRID 4326)",
      description: "Coordenada decimal [-180, 180].",
      required: true,
      type: "number",
    },
    {
      key: "elevation",
      label: "Elevación (Pies/Metros)",
      description: "Altitud de la pista respecto al nivel del mar.",
      required: false,
      type: "number",
    },
  ],
  routes: [
    {
      key: "routeId",
      label: "ID de Conexión / Tramo",
      description: "Identificador del par de ruta o segmento.",
      required: true,
      type: "string",
    },
    {
      key: "originId",
      label: "Aeropuerto Origen",
      description: "Código IATA o ICAO del nodo origen.",
      required: true,
      type: "string",
    },
    {
      key: "destinationId",
      label: "Aeropuerto Destino",
      description: "Código IATA o ICAO del nodo destino.",
      required: true,
      type: "string",
    },
    {
      key: "airlineId",
      label: "Aerolínea Operadora",
      description: "Código comercial o designador OACI.",
      required: true,
      type: "string",
    },
    {
      key: "aircraftType",
      label: "Tipo de Aeronave",
      description: "Modelo de avión asignado (ej. B738, A320).",
      required: false,
      type: "string",
    },
  ],
  otp_metrics: [
    {
      key: "flightId",
      label: "Identificador de Vuelo",
      description: "Clave única del registro o número de vuelo.",
      required: true,
      type: "string",
    },
    {
      key: "originId",
      label: "Origen (Tupla OTP)",
      description: "Nodo de salida para la tupla analítica.",
      required: true,
      type: "string",
    },
    {
      key: "destinationId",
      label: "Destino (Tupla OTP)",
      description: "Nodo de arribo para la tupla analítica.",
      required: true,
      type: "string",
    },
    {
      key: "airlineId",
      label: "Aerolínea (Tupla OTP)",
      description: "Compañía responsable del itinerario.",
      required: true,
      type: "string",
    },
    {
      key: "delayMinutes",
      label: "Demora en Minutos",
      description: "Retraso de arribo en minutos (cálculo OTP-15).",
      required: true,
      type: "number",
    },
    {
      key: "isCancelled",
      label: "Indicador de Cancelación",
      description: "Bandera booleana de cancelación del vuelo.",
      required: false,
      type: "boolean",
    },
  ],
};

const currentTargetFields = computed(() => {
  return targetFieldsCatalog[props.targetEntity] || [];
});

const transformOptions = [
  { label: "Sin transformación", value: "none" },
  { label: "A Mayúsculas (UPPERCASE)", value: "uppercase" },
  { label: "Limpiar espacios (Trim)", value: "trim" },
  { label: "Convertir a Número", value: "to_number" },
  { label: "Convertir a Booleano", value: "to_boolean" },
  { label: "Punto PostGIS (SRID 4326)", value: "srid_4326_point" },
];

function getMappingForField(targetKey: string): FieldMappingRule {
  const existing = props.modelValue.find((m) => m.targetField === targetKey);
  if (existing) return existing;
  return {
    sourceColumn: "",
    targetField: targetKey,
    transform: "none",
    required: currentTargetFields.value.find((f) => f.key === targetKey)?.required || false,
  };
}

function updateRule(targetKey: string, fieldPatch: Partial<FieldMappingRule>) {
  const next = [...props.modelValue];
  const idx = next.findIndex((m) => m.targetField === targetKey);
  const targetDef = currentTargetFields.value.find((f) => f.key === targetKey);

  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      ...fieldPatch,
      required: targetDef?.required || false,
    } as FieldMappingRule;
  } else {
    next.push({
      sourceColumn: "",
      targetField: targetKey,
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
        sourceColumn: match,
        targetField: target.key,
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

      <UButton
        v-if="detectedColumns.length > 0"
        size="xs"
        variant="outline"
        color="primary"
        icon="i-lucide-sparkles"
        class="cursor-pointer font-bold shrink-0"
        @click="autoDetectMapping"
      >
        Mapeo Heurístico Automático
      </UButton>
    </div>

    <!-- Lista de Campos del Modelo Destino -->
    <div class="space-y-2.5">
      <div
        v-for="target in currentTargetFields"
        :key="target.key"
        class="p-3 rounded-xl border border-border-subtle bg-surface-card hover:border-primary/40 transition-colors space-y-2"
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
              Requerido
            </UBadge>
          </div>
          <span class="text-[10px] font-mono text-text-muted">
            Tipo: {{ target.type }}
          </span>
        </div>

        <p class="text-[11px] text-text-muted">
          {{ target.description }}
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
              :model-value="getMappingForField(target.key).sourceColumn"
              placeholder="Ej: ident, origin_iata, etc."
              size="sm"
              class="w-full font-mono text-xs"
              @update:model-value="
                (val) => updateRule(target.key, { sourceColumn: String(val) })
              "
            />
            <select
              v-else
              :value="getMappingForField(target.key).sourceColumn"
              class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-primary focus:outline-none"
              @change="
                (e) =>
                  updateRule(target.key, {
                    sourceColumn: (e.target as HTMLSelectElement).value,
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
                    transform: (e.target as HTMLSelectElement).value as any,
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
