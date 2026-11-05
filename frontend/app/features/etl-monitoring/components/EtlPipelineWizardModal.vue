<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type {
  ProcesoEtl,
  PipelineConnectionConfig,
  PipelineScheduleConfig,
  FieldMappingRule,
  TargetEntity,
  IngestionSourceType,
  IngestionDataFormat,
  ProbeEndpointResult,
} from "../types/etl";
import { TARGET_FIELDS_CATALOG } from "../types/etl";
import {
  pipelineIdentitySchema,
  pipelineConnectionSchema,
  pipelineScheduleConfigSchema,
  pipelineSchema,
} from "../schemas/pipelineSchemas";
import EtlEndpointProbeCard from "./EtlEndpointProbeCard.vue";
import EtlSchemaMapper from "./EtlSchemaMapper.vue";

interface Props {
  isOpen: boolean;
  pipelineToEdit: ProcesoEtl | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: Partial<ProcesoEtl>): void;
}>();

const currentStep = ref(1);
const totalSteps = 4;

// Flags de intento de interacción para mostrar errores
const hasAttemptedStep1 = ref(false);
const hasAttemptedStep2 = ref(false);
const hasAttemptedStep3 = ref(false);
const hasAttemptedStep4 = ref(false);

// 1. Datos de Identidad
const nombre = ref("");
const nombreConjunto = ref("");
const descripcion = ref("");
const icon = ref("i-lucide-database");
const entidadDestino = ref<TargetEntity>("aeropuertos");

// 2. Datos de Conexión & Endpoint
const tipoFuente = ref<IngestionSourceType>("http_stream");
const urlEndpoint = ref("");
const metodoHttp = ref<"GET">("GET");
const formatoDatos = ref<IngestionDataFormat>("csv");
const separadorCsv = ref(",");
const csvConCabecera = ref(true);
const headersList = ref<{ key: string; referenciaCredencial: string }[]>([]);

// Test Endpoint Probe
const isTesting = ref(false);
const probeResult = ref<ProbeEndpointResult | null>(null);
const detectedColumns = ref<string[]>([]);

// 3. Mapeo Semántico
const mapeoEsquema = ref<FieldMappingRule[]>([]);

// 4. Planificación y RNF-04
const cronPreset = ref<"manual" | "hourly" | "daily" | "weekly" | "monthly" | "custom">("daily");
const customCron = ref("0 4 * * *");
const tamanoLote = ref(2000);
const tiempoLimiteSegundos = ref(300);
const maximoReintentos = ref(2);

// --- REGLAS DE VALIDACIÓN BASADAS EN ESQUEMAS ZOD ---
// Validación Paso 1 (Identidad) mediante Zod
const step1Validation = computed(() => {
  return pipelineIdentitySchema.safeParse({
    nombre: nombre.value,
    nombreConjunto: nombreConjunto.value,
    descripcion: descripcion.value,
    icon: icon.value,
    entidadDestino: entidadDestino.value,
  });
});

const isStep1Valid = computed(() => step1Validation.value.success);

const nameError = computed(() => {
  if (step1Validation.value.success) return "";
  const issue = step1Validation.value.error.issues.find(
    (i) => i.path[0] === "nombre",
  );
  return issue ? issue.message : "";
});

const datasetNameError = computed(() => {
  if (step1Validation.value.success) return "";
  const issue = step1Validation.value.error.issues.find(
    (i) => i.path[0] === "nombreConjunto",
  );
  return issue ? issue.message : "";
});

// Validación Paso 2 (Endpoint & Conexión) mediante Zod
const step2Validation = computed(() => {
  return pipelineConnectionSchema.safeParse(connectionConfig.value);
});

const isStep2Valid = computed(() => step2Validation.value.success);

const endpointUrlError = computed(() => {
  if (step2Validation.value.success) return "";
  const issue = step2Validation.value.error.issues.find(
    (i) => i.path[0] === "urlEndpoint",
  );
  return issue ? issue.message : "";
});

const csvDelimiterError = computed(() => {
  if (step2Validation.value.success) return "";
  const issue = step2Validation.value.error.issues.find(
    (i) => i.path[0] === "separadorCsv",
  );
  return issue ? issue.message : "";
});

// Validación Paso 3 (Mapeo Semántico)
const requiredTargetFields = computed(() => {
  return (TARGET_FIELDS_CATALOG[entidadDestino.value] || []).filter(
    (f) => f.required,
  );
});

const unmappedRequiredFields = computed(() => {
  return requiredTargetFields.value.filter((targetDef) => {
    const rule = mapeoEsquema.value.find(
      (m) => m.campoDestino === targetDef.key,
    );
    return !rule || !rule.columnaOrigen || !rule.columnaOrigen.trim();
  });
});

const isStep3Valid = computed(() => unmappedRequiredFields.value.length === 0);

// Validación Paso 4 (Planificación) mediante Zod
const step4Validation = computed(() => {
  return pipelineScheduleConfigSchema.safeParse({
    cronPreset: cronPreset.value,
    expresionCron: customCron.value,
    scheduleDescription: "Cadencia",
    tamanoLote: tamanoLote.value,

    tiempoLimiteSegundos: tiempoLimiteSegundos.value,
    maximoReintentos: maximoReintentos.value,
  });
});

const isStep4Valid = computed(() => step4Validation.value.success);

const customCronError = computed(() => {
  if (step4Validation.value.success) return "";
  const issue = step4Validation.value.error.issues.find(
    (i) => i.path[0] === "expresionCron",
  );
  return issue ? issue.message : "";
});

const availableIcons = [
  "i-lucide-database",
  "i-lucide-plane-takeoff",
  "i-lucide-radar",
  "i-lucide-route",
  "i-lucide-timer",
  "i-lucide-map-pin",
  "i-lucide-git-commit-horizontal",
  "i-lucide-globe",
  "i-lucide-radio",
  "i-lucide-cpu",
];

const targetEntityOptions = [
  { value: "paises", label: "Países", descripcion: "Nombre y código ISO opcional." },
  { value: "aerolineas", label: "Aerolíneas", descripcion: "Identidad, códigos y estado del catálogo." },
  {
    value: "aeropuertos",
    label: "Catálogo de Aeropuertos y Pistas",
    descripcion: "Coordenadas SRID 4326, pistas y códigos ICAO/IATA.",
  },
  {
    value: "rutas",
    label: "Red de Conexiones y Rutas",
    descripcion: "Pares origen-destino, operadoras y arcos geodésicos.",
  },
  {
    value: "otp_metrics",
    label: "OTP-15 (próxima entrega)",
    disabled: true,
    descripcion: "Vuelos, demoras en minutos, cancelaciones y métricas.",
  },
];

const cronPresetsOptions = [
  { value: "manual", label: "A demanda (Solo manual)" },
  { value: "hourly", label: "Cada 1 hora" },
  { value: "daily", label: "Diario (04:00 UTC)" },
  { value: "weekly", label: "Semanal (Domingos 03:00 UTC)" },
  { value: "monthly", label: "Mensual (Día 1 de cada mes)" },
  { value: "custom", label: "Expresión Cron Personalizada" },
];

const connectionConfig = computed<PipelineConnectionConfig>(() => ({
  tipoFuente: tipoFuente.value,
  urlEndpoint: urlEndpoint.value,
  metodoHttp: metodoHttp.value,
  formatoDatos: formatoDatos.value,
  separadorCsv: separadorCsv.value,
  csvConCabecera: csvConCabecera.value,
  headers: headersList.value.filter((h) => h.key.trim() !== ""),
}));

// Reset o precarga al abrir el modal
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      currentStep.value = 1;
      probeResult.value = null;
      hasAttemptedStep1.value = false;
      hasAttemptedStep2.value = false;
      hasAttemptedStep3.value = false;
      hasAttemptedStep4.value = false;

      if (props.pipelineToEdit) {
        // Cargar datos existentes
        const p = props.pipelineToEdit;
        nombre.value = p.nombre;
        nombreConjunto.value = p.nombreConjunto;
        descripcion.value = p.descripcion;
        icon.value = p.icon;
        entidadDestino.value = p.entidadDestino || "otp_metrics";

        if (p.conexion) {
          tipoFuente.value = p.conexion.tipoFuente;
          urlEndpoint.value = p.conexion.urlEndpoint;
          metodoHttp.value = p.conexion.metodoHttp;
          formatoDatos.value = p.conexion.formatoDatos;
          separadorCsv.value = p.conexion.separadorCsv || ",";
          csvConCabecera.value = p.conexion.csvConCabecera ?? true;
          headersList.value = p.conexion.headers ? [...p.conexion.headers] : [];
        }

        mapeoEsquema.value = p.mapeoEsquema ? [...p.mapeoEsquema] : [];
        detectedColumns.value = mapeoEsquema.value.map(rule => rule.columnaOrigen);

        if (p.configuracionProgramacion) {
          cronPreset.value = p.configuracionProgramacion.expresionCron ? "custom" : "manual";
          customCron.value = p.configuracionProgramacion.expresionCron;
          tamanoLote.value = p.configuracionProgramacion.tamanoLote;
          tiempoLimiteSegundos.value = p.configuracionProgramacion.tiempoLimiteSegundos;
          maximoReintentos.value = p.configuracionProgramacion.maximoReintentos;
        }
      } else {
        // Valores por defecto para nueva creación
        nombre.value = "";
        nombreConjunto.value = "";
        descripcion.value = "";
        icon.value = "i-lucide-database";
        entidadDestino.value = "aeropuertos";
        tipoFuente.value = "http_stream";
        urlEndpoint.value = "https://";
        metodoHttp.value = "GET";
        formatoDatos.value = "csv";
        separadorCsv.value = ",";
        csvConCabecera.value = true;
        headersList.value = [];
        mapeoEsquema.value = [];
        cronPreset.value = "daily";
        customCron.value = "0 4 * * *";
        tamanoLote.value = 2000;
        tiempoLimiteSegundos.value = 300;
        maximoReintentos.value = 2;
        detectedColumns.value = [];
      }
    }
  },
);

function addHeader() {
  headersList.value.push({ key: "", referenciaCredencial: "" });
}

function removeHeader(idx: number) {
  headersList.value.splice(idx, 1);
}

const { testEndpoint } = usePipelineCrud();
async function handleTestConnection() {
  isTesting.value = true;
  try {
    probeResult.value = await testEndpoint(connectionConfig.value);
    detectedColumns.value = probeResult.value.detectedColumns;
  } catch (error) {
    probeResult.value = { success: false, statusCode: 0, latencyMs: 0, contentType: '', sampleRows: [], detectedColumns: [], mensajeError: error instanceof Error ? error.message : 'No se pudo comprobar el recurso' };
  } finally { isTesting.value = false; }
}

function handleApplyDetectedColumns(columns: string[]) {
  detectedColumns.value = columns;
  hasAttemptedStep2.value = false;
  // Avanzar al paso de mapeo
  currentStep.value = 3;
}

function goToStep(stepNum: number) {
  if (stepNum > 1 && !isStep1Valid.value) {
    hasAttemptedStep1.value = true;
    currentStep.value = 1;
    return;
  }
  if (stepNum > 2 && !isStep2Valid.value) {
    hasAttemptedStep2.value = true;
    currentStep.value = 2;
    return;
  }
  if (stepNum > 3 && !isStep3Valid.value) {
    hasAttemptedStep3.value = true;
    currentStep.value = 3;
    return;
  }
  currentStep.value = stepNum;
}

function handleNextStep() {
  if (currentStep.value === 1) {
    hasAttemptedStep1.value = true;
    if (!isStep1Valid.value) return;
  } else if (currentStep.value === 2) {
    hasAttemptedStep2.value = true;
    if (!isStep2Valid.value) return;
  } else if (currentStep.value === 3) {
    hasAttemptedStep3.value = true;
    if (!isStep3Valid.value) return;
  }

  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

function handlePrevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function handleSave() {
  hasAttemptedStep1.value = true;
  hasAttemptedStep2.value = true;
  hasAttemptedStep3.value = true;
  hasAttemptedStep4.value = true;

  if (!isStep1Valid.value) {
    currentStep.value = 1;
    return;
  }
  if (!isStep2Valid.value) {
    currentStep.value = 2;
    return;
  }
  if (!isStep3Valid.value) {
    currentStep.value = 3;
    return;
  }
  if (!isStep4Valid.value) {
    currentStep.value = 4;
    return;
  }

  let scheduleDesc = "Diario";
  let cronExpr = customCron.value;

  if (cronPreset.value === "manual") {
    scheduleDesc = "A demanda (Manual)";
    cronExpr = "";
  } else if (cronPreset.value === "hourly") {
    scheduleDesc = "Cada 1 hora";
    cronExpr = "0 * * * *";
  } else if (cronPreset.value === "daily") {
    scheduleDesc = "Diario (04:00 UTC)";
    cronExpr = "0 4 * * *";
  } else if (cronPreset.value === "weekly") {
    scheduleDesc = "Semanal (Domingos 03:00 UTC)";
    cronExpr = "0 3 * * 0";
  } else if (cronPreset.value === "monthly") {
    scheduleDesc = "Mensual (Día 1 de cada mes)";
    cronExpr = "0 0 1 * *";
  } else {
    scheduleDesc = `Cron (${customCron.value})`;
  }

  const payload: Partial<ProcesoEtl> = {
    nombre: nombre.value.trim(),
    nombreConjunto: nombreConjunto.value.trim(),
    descripcion: descripcion.value.trim() || "Pipeline de ingesta de datos aeronáuticos.",
    icon: icon.value,
    entidadDestino: entidadDestino.value,
    conexion: connectionConfig.value,
    mapeoEsquema: mapeoEsquema.value,
    scheduleDescription: scheduleDesc,
    configuracionProgramacion: {
      expresionCron: cronExpr,
      tamanoLote: tamanoLote.value,
      tiempoLimiteSegundos: tiempoLimiteSegundos.value,
      maximoReintentos: maximoReintentos.value,
    },
  };

  const validation = pipelineSchema.safeParse(payload);
  if (!validation.success) {
    return;
  }

  emit("save", payload);
}
</script>

<template>
  <UModal
    :open="isOpen"
    :title="pipelineToEdit ? `Editar: ${pipelineToEdit.nombre}` : 'Nuevo Servicio de Ingesta ETL'"
    description="Configura la conexión al endpoint, mapeo y parámetros de ejecución asíncrona."
    :ui="{
      content:
        'max-w-3xl bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="
      (val: boolean) => {
        if (!val) emit('close');
      }
    "
  >
    <template #body>
      <div class="space-y-6 text-xs font-feature-tech">
        <!-- Indicador de Pasos (Stepper) -->
        <div class="grid grid-cols-4 gap-2 border-b border-border-subtle pb-4">
          <button
            v-for="step in [
              { num: 1, label: 'Identidad' },
              { num: 2, label: 'Endpoint & Conexión' },
              { num: 3, label: 'Mapeo' },
              { num: 4, label: 'Planificación' },
            ]"
            :key="step.num"
            type="button"
            class="text-left py-1.5 px-2 rounded-lg transition-colors cursor-pointer"
            :class="[
              currentStep === step.num
                ? 'bg-primary/10 border-l-2 border-primary text-primary font-bold'
                : currentStep > step.num
                  ? 'text-text-main font-semibold'
                  : 'text-text-dim hover:text-text-muted',
            ]"
            @click="goToStep(step.num)"
          >
            <span class="block text-[10px] uppercase font-mono">
              Paso {{ step.num }}
            </span>
            <span class="block text-xs truncate">
              {{ step.label }}
            </span>
          </button>
        </div>

        <!-- ============================================== -->
        <!-- PASO 1: Identidad & Destino                     -->
        <!-- ============================================== -->
        <div v-show="currentStep === 1" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-semibold text-text-main mb-1">
                Nombre del Servicio *
              </label>
              <UInput
                v-model="nombre"
                placeholder="Ej. OpenSky Live Vectors"
                size="sm"
                :color="hasAttemptedStep1 && nameError ? 'error' : undefined"
                class="w-full text-xs"
              />
              <p
                v-if="hasAttemptedStep1 && nameError"
                class="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-sans font-medium"
              >
                <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5 shrink-0" />
                {{ nameError }}
              </p>
            </div>
            <div>
              <label class="block font-semibold text-text-main mb-1">
                Nombre del Dataset *
              </label>
              <UInput
                v-model="nombreConjunto"
                placeholder="Ej. OpenSky Network API"
                size="sm"
                :color="hasAttemptedStep1 && datasetNameError ? 'error' : undefined"
                class="w-full text-xs"
              />
              <p
                v-if="hasAttemptedStep1 && datasetNameError"
                class="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-sans font-medium"
              >
                <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5 shrink-0" />
                {{ datasetNameError }}
              </p>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-text-main mb-1">
              Descripción Operativa
            </label>
            <UInput
              v-model="descripcion"
              placeholder="Finalidad del dataset, cobertura geográfica y origen de los datos..."
              size="sm"
              class="w-full text-xs"
            />
          </div>

          <!-- Selector de Entidad Destino -->
          <div>
            <label class="block font-semibold text-text-main mb-1.5">
              Entidad de Destino en FlyWise *
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                v-for="opt in targetEntityOptions"
                :key="opt.value"
                :disabled="opt.value === 'otp_metrics'"
                type="button"
                class="p-3 rounded-xl border text-left transition-all cursor-pointer"
                :class="[
                  entidadDestino === opt.value
                    ? 'border-primary bg-primary/5 text-primary shadow-xs'
                    : 'border-border-subtle bg-surface-card hover:border-border-hover text-text-main',
                ]"
                @click="entidadDestino = opt.value as TargetEntity"
              >
                <span class="font-bold text-xs block mb-1">
                  {{ opt.label }}
                </span>
                <span class="text-[11px] text-text-muted leading-tight block">
                  {{ opt.descripcion }}
                </span>
              </button>
            </div>
          </div>

          <!-- Selector de Icono -->
          <div>
            <label class="block font-semibold text-text-muted text-[11px] mb-1.5">
              Icono de Identificación
            </label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="ic in availableIcons"
                :key="ic"
                type="button"
                class="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
                :class="[
                  icon === ic
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-subtle bg-surface-card hover:border-border-hover text-text-dim',
                ]"
                @click="icon = ic"
              >
                <UIcon :name="ic" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- PASO 2: Conexión & Endpoint                     -->
        <!-- ============================================== -->
        <div v-show="currentStep === 2" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold text-text-main mb-1">
                Tipo de Conexión *
              </label>
              <select
                v-model="tipoFuente"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option value="http_stream">HTTP GET (CSV / .dat)</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-text-main mb-1">
                Método HTTP *
              </label>
              <select
                v-model="metodoHttp"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option value="GET">GET</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-text-main mb-1">
                Formato de Datos *
              </label>
              <select
                v-model="formatoDatos"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option value="csv">CSV (Texto separado por coma)</option>
              </select>
            </div>
          </div>

          <!-- URL del Endpoint -->
          <div>
            <label class="block font-semibold text-text-main mb-1">
              URL del Endpoint / Recurso Remoto *
            </label>
            <UInput
              v-model="urlEndpoint"
              placeholder="https://api.aviation-feed.com/v1/delays.csv"
              size="sm"
              icon="i-lucide-link"
              :color="hasAttemptedStep2 && endpointUrlError ? 'error' : undefined"
              class="w-full font-mono text-xs"
            />
            <p
              v-if="hasAttemptedStep2 && endpointUrlError"
              class="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-sans font-medium"
            >
              <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5 shrink-0" />
              {{ endpointUrlError }}
            </p>
            <span v-else class="text-[10px] text-text-dim mt-1 block">
              URL fija de un host autorizado por el administrador del servidor.
            </span>
          </div>

          <!-- Opciones de CSV / JSON -->
          <div
            v-if="formatoDatos === 'csv'"
            class="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border-subtle bg-surface-card"
          >
            <div>
              <label class="block text-[11px] font-semibold text-text-muted mb-1">
                Delimitador CSV: *
              </label>
              <UInput
                v-model="separadorCsv"
                size="xs"
                :color="hasAttemptedStep2 && csvDelimiterError ? 'error' : undefined"
                class="w-24 font-mono text-center text-xs"
              />
              <p
                v-if="hasAttemptedStep2 && csvDelimiterError"
                class="text-rose-500 text-[10px] mt-1 font-medium"
              >
                {{ csvDelimiterError }}
              </p>
            </div>
            <div class="flex items-center pt-4">
              <UCheckbox
                v-model="csvConCabecera"
                label="Primera fila contiene encabezados"
              />
            </div>
          </div>

          <!-- Cabeceras HTTP de Autenticación -->
          <div class="space-y-2 pt-2 border-t border-border-subtle">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-xs text-text-main">
                Cabeceras HTTP Personalizadas (Tokens / API Keys)
              </span>
              <UButton
                size="xs"
                variant="ghost"
                color="primary"
                icon="i-lucide-plus"
                class="cursor-pointer text-[11px] font-bold"
                @click="addHeader"
              >
                Añadir Cabecera
              </UButton>
            </div>

            <div
              v-for="(hdr, idx) in headersList"
              :key="idx"
              class="flex items-center gap-2"
            >
              <UInput
                v-model="hdr.key"
                placeholder="Header (ej. x-api-key)"
                size="xs"
                class="w-1/3 font-mono text-xs"
              />
              <UInput
                v-model="hdr.referenciaCredencial"
                placeholder="Variable autorizada del servidor"
                type="text"
                size="xs"
                class="flex-1 font-mono text-xs"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash"
                class="cursor-pointer shrink-0"
                @click="removeHeader(idx)"
              />
            </div>
          </div>

          <!-- Widget de Verificación Activa (Probe & Ping) -->
          <EtlEndpointProbeCard
            :conexion="connectionConfig"
            :probe-result="probeResult"
            :is-loading="isTesting"
            @test-conexion="handleTestConnection"
            @apply-detected-columns="handleApplyDetectedColumns"
          />
        </div>

        <!-- ============================================== -->
        <!-- PASO 3: Mapeo Semántico                         -->
        <!-- ============================================== -->
        <div v-show="currentStep === 3" class="space-y-4">
          <!-- Alerta de validación de mapeo requerido -->
          <div
            v-if="hasAttemptedStep3 && !isStep3Valid"
            class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5"
          >
            <UIcon name="i-lucide-alert-triangle" class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div class="space-y-1">
              <span class="font-bold block text-text-main">
                Faltan campos obligatorios por mapear
              </span>
              <p class="text-[11px] leading-relaxed text-text-muted">
                Debes mapear una columna de origen para cada uno de los campos requeridos:
                <strong class="text-rose-600 dark:text-rose-400 font-semibold">
                  {{ unmappedRequiredFields.map((f) => f.label).join(", ") }}
                </strong>.
              </p>
            </div>
          </div>

          <EtlSchemaMapper
            v-model="mapeoEsquema"
            :target-entity="entidadDestino"
            :detected-columns="detectedColumns"
          />
        </div>

        <!-- ============================================== -->
        <!-- PASO 4: Planificación & Guardrails RNF-04       -->
        <!-- ============================================== -->
        <div v-show="currentStep === 4" class="space-y-4">
          <div>
            <label class="block font-semibold text-text-main mb-1.5">
              Cadencia y Frecuencia de Ejecución
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="preset in cronPresetsOptions"
                :key="preset.value"
                type="button"
                class="p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer"
                :class="[
                  cronPreset === preset.value
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border-subtle bg-surface-card hover:border-border-hover text-text-main',
                ]"
                @click="cronPreset = preset.value as typeof cronPreset"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <div v-if="cronPreset === 'custom'">
            <label class="block text-[11px] font-semibold text-text-muted mb-1">
              Expresión Cron Estándar (5 campos): *
            </label>
            <UInput
              v-model="customCron"
              placeholder="0 4 * * *"
              size="sm"
              :color="hasAttemptedStep4 && customCronError ? 'error' : undefined"
              class="w-full font-mono text-xs"
            />
            <p
              v-if="hasAttemptedStep4 && customCronError"
              class="text-rose-500 text-[11px] mt-1 flex items-center gap-1 font-sans font-medium"
            >
              <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5 shrink-0" />
              {{ customCronError }}
            </p>
          </div>

          <!-- Guardrail RNF-04: Batch Size en BullMQ -->
          <div class="p-3.5 rounded-xl border border-border-subtle bg-surface-card space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-bold text-xs text-text-main block">
                  Tamaño de Lote por Worker (Guardrail RNF-04)
                </span>
                <span class="text-[11px] text-text-muted">
                  Restricción de arquitectura: Entre 1.000 y 5.000 filas por chunk en BullMQ.
                </span>
              </div>
              <UBadge color="primary" variant="subtle" size="sm" class="font-mono font-bold">
                {{ tamanoLote.toLocaleString() }} filas
              </UBadge>
            </div>

            <UFieldGroup class="w-full flex">
              <UButton
                v-for="s in [1000, 2000, 5000]"
                :key="s"
                :variant="tamanoLote === s ? 'solid' : 'outline'"
                :color="tamanoLote === s ? 'primary' : 'neutral'"
                size="xs"
                class="flex-1 justify-center font-mono cursor-pointer"
                @click="tamanoLote = s"
              >
                {{ s.toLocaleString() }} filas
              </UButton>
            </UFieldGroup>
          </div>

          <!-- Concurrencia y Resiliencia -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-text-muted mb-1">
                Reintentos ante Fallo:
              </label>
              <select
                v-model.number="maximoReintentos"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option :value="1">1 reintento</option>
                <option :value="2">2 reintentos (Backoff exponencial)</option>
                <option :value="5">5 reintentos</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-between">
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          class="text-xs font-semibold cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </UButton>

        <div class="flex items-center gap-2">
          <UButton
            v-if="currentStep > 1"
            variant="outline"
            color="neutral"
            size="sm"
            icon="i-lucide-arrow-left"
            class="text-xs font-semibold cursor-pointer"
            @click="handlePrevStep"
          >
            Anterior
          </UButton>

          <UButton
            v-if="currentStep < totalSteps"
            color="primary"
            size="sm"
            trailing-icon="i-lucide-arrow-right"
            class="text-xs font-semibold cursor-pointer text-white"
            @click="handleNextStep"
          >
            Siguiente Paso
          </UButton>

          <UButton
            v-else
            color="success"
            size="sm"
            icon="i-lucide-check-circle"
            class="text-xs font-semibold cursor-pointer text-white"
            @click="handleSave"
          >
            {{ pipelineToEdit ? "Guardar Cambios" : "Crear Servicio" }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
