<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type {
  EtlPipeline,
  PipelineConnectionConfig,
  PipelineScheduleConfig,
  FieldMappingRule,
  TargetEntity,
  IngestionSourceType,
  IngestionDataFormat,
  ProbeEndpointResult,
} from "../types/etl";
import EtlEndpointProbeCard from "./EtlEndpointProbeCard.vue";
import EtlSchemaMapper from "./EtlSchemaMapper.vue";

interface Props {
  isOpen: boolean;
  pipelineToEdit: EtlPipeline | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: Partial<EtlPipeline>): void;
}>();

const currentStep = ref(1);
const totalSteps = 4;

// 1. Datos de Identidad
const name = ref("");
const datasetName = ref("");
const description = ref("");
const icon = ref("i-lucide-database");
const targetEntity = ref<TargetEntity>("otp_metrics");

// 2. Datos de Conexión & Endpoint
const sourceType = ref<IngestionSourceType>("http_stream");
const endpointUrl = ref("");
const httpMethod = ref<"GET" | "POST">("GET");
const dataFormat = ref<IngestionDataFormat>("csv");
const csvDelimiter = ref(",");
const csvHasHeader = ref(true);
const rootJsonPath = ref("");
const headersList = ref<{ key: string; value: string }[]>([]);

// Test Endpoint Probe
const isTesting = ref(false);
const probeResult = ref<ProbeEndpointResult | null>(null);
const detectedColumns = ref<string[]>([]);

// 3. Mapeo Semántico
const schemaMapping = ref<FieldMappingRule[]>([]);

// 4. Planificación y RNF-04
const cronPreset = ref<"manual" | "hourly" | "daily" | "weekly" | "monthly" | "custom">("daily");
const customCron = ref("0 4 * * *");
const batchSize = ref(2500);
const concurrency = ref(4);
const timeoutSeconds = ref(300);
const maxRetries = ref(3);

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
  {
    value: "airports",
    label: "Catálogo de Aeropuertos y Pistas",
    description: "Coordenadas SRID 4326, pistas y códigos ICAO/IATA.",
  },
  {
    value: "routes",
    label: "Red de Conexiones y Rutas",
    description: "Pares origen-destino, operadoras y arcos geodésicos.",
  },
  {
    value: "otp_metrics",
    label: "Telemetría y Desempeño OTP-15",
    description: "Vuelos, demoras en minutos, cancelaciones y métricas.",
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
  sourceType: sourceType.value,
  endpointUrl: endpointUrl.value,
  httpMethod: httpMethod.value,
  dataFormat: dataFormat.value,
  csvDelimiter: csvDelimiter.value,
  csvHasHeader: csvHasHeader.value,
  rootJsonPath: rootJsonPath.value,
  headers: headersList.value.filter((h) => h.key.trim() !== ""),
}));

// Reset o precarga al abrir el modal
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      currentStep.value = 1;
      probeResult.value = null;

      if (props.pipelineToEdit) {
        // Cargar datos existentes
        const p = props.pipelineToEdit;
        name.value = p.name;
        datasetName.value = p.datasetName;
        description.value = p.description;
        icon.value = p.icon;
        targetEntity.value = p.targetEntity || "otp_metrics";

        if (p.connection) {
          sourceType.value = p.connection.sourceType;
          endpointUrl.value = p.connection.endpointUrl;
          httpMethod.value = p.connection.httpMethod;
          dataFormat.value = p.connection.dataFormat;
          csvDelimiter.value = p.connection.csvDelimiter || ",";
          csvHasHeader.value = p.connection.csvHasHeader ?? true;
          rootJsonPath.value = p.connection.rootJsonPath || "";
          headersList.value = p.connection.headers ? [...p.connection.headers] : [];
        }

        schemaMapping.value = p.schemaMapping ? [...p.schemaMapping] : [];

        if (p.scheduleConfig) {
          cronPreset.value = p.scheduleConfig.cronPreset;
          customCron.value = p.scheduleConfig.cronExpression;
          batchSize.value = p.scheduleConfig.batchSize;
          concurrency.value = p.scheduleConfig.concurrency;
          timeoutSeconds.value = p.scheduleConfig.timeoutSeconds;
          maxRetries.value = p.scheduleConfig.maxRetries;
        }
      } else {
        // Valores por defecto para nueva creación
        name.value = "";
        datasetName.value = "";
        description.value = "";
        icon.value = "i-lucide-database";
        targetEntity.value = "otp_metrics";
        sourceType.value = "http_stream";
        endpointUrl.value = "https://";
        httpMethod.value = "GET";
        dataFormat.value = "csv";
        csvDelimiter.value = ",";
        csvHasHeader.value = true;
        rootJsonPath.value = "";
        headersList.value = [];
        schemaMapping.value = [];
        cronPreset.value = "daily";
        customCron.value = "0 4 * * *";
        batchSize.value = 2500;
        concurrency.value = 4;
        timeoutSeconds.value = 300;
        maxRetries.value = 3;
        detectedColumns.value = [];
      }
    }
  },
);

function addHeader() {
  headersList.value.push({ key: "", value: "" });
}

function removeHeader(idx: number) {
  headersList.value.splice(idx, 1);
}

// Simulación de prueba de endpoint
async function handleTestConnection() {
  isTesting.value = true;
  probeResult.value = null;

  const startTime = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 550));
  const latency = Math.round(performance.now() - startTime);

  if (!endpointUrl.value.startsWith("http")) {
    probeResult.value = {
      success: false,
      statusCode: 400,
      latencyMs: 8,
      contentType: "text/plain",
      sampleRows: [],
      detectedColumns: [],
      errorMessage: "La URL debe iniciar con protocolo http:// o https://",
    };
    isTesting.value = false;
    return;
  }

  // Generar columnas de prueba acordes a la entidad seleccionada
  let cols: string[] = [];
  let samples: Record<string, any>[] = [];

  if (targetEntity.value === "airports") {
    cols = ["ident", "type", "name", "latitude_deg", "longitude_deg", "elevation_ft", "iata_code"];
    samples = [
      { ident: "SAEZ", type: "large_airport", name: "Ezeiza Intl", latitude_deg: -34.8222, longitude_deg: -58.5358, iata_code: "EZE" },
      { ident: "KJFK", type: "large_airport", name: "John F Kennedy", latitude_deg: 40.6398, longitude_deg: -73.7789, iata_code: "JFK" },
    ];
  } else if (targetEntity.value === "routes") {
    cols = ["route_id", "airline", "source_airport", "dest_airport", "stops", "equipment"];
    samples = [
      { route_id: "RT-1092", airline: "AR", source_airport: "EZE", dest_airport: "MAD", stops: 0, equipment: "A332" },
      { route_id: "RT-8841", airline: "IB", source_airport: "MAD", dest_airport: "EZE", stops: 0, equipment: "A359" },
    ];
  } else {
    cols = ["flight_num", "carrier", "origin", "dest", "dep_time", "arr_delay", "cancelled"];
    samples = [
      { flight_num: "AR1302", carrier: "AR", origin: "AEP", dest: "COR", dep_time: "10:15", arr_delay: 5, cancelled: 0 },
      { flight_num: "LA450", carrier: "LA", origin: "SCL", dest: "EZE", dep_time: "14:40", arr_delay: -10, cancelled: 0 },
    ];
  }

  detectedColumns.value = cols;
  probeResult.value = {
    success: true,
    statusCode: 200,
    latencyMs: latency || 65,
    contentType: dataFormat.value === "csv" ? "text/csv; charset=utf-8" : "application/json",
    detectedColumns: cols,
    sampleRows: samples,
    estimatedTotalSize: "~3.4 MB (~42.000 filas)",
  };

  isTesting.value = false;
}

function handleApplyDetectedColumns(columns: string[]) {
  detectedColumns.value = columns;
  // Avanzar al paso de mapeo
  currentStep.value = 3;
}

function handleNextStep() {
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

  const payload: Partial<EtlPipeline> = {
    name: name.value.trim() || "Servicio Personalizado",
    datasetName: datasetName.value.trim() || "Fuente Externa",
    description: description.value.trim() || "Pipeline de ingesta de datos aeronáuticos.",
    icon: icon.value,
    targetEntity: targetEntity.value,
    connection: connectionConfig.value,
    schemaMapping: schemaMapping.value,
    scheduleDescription: scheduleDesc,
    scheduleConfig: {
      cronPreset: cronPreset.value,
      cronExpression: cronExpr,
      scheduleDescription: scheduleDesc,
      batchSize: batchSize.value,
      concurrency: concurrency.value,
      timeoutSeconds: timeoutSeconds.value,
      maxRetries: maxRetries.value,
    },
  };

  emit("save", payload);
  emit("close");
}
</script>

<template>
  <UModal
    :open="isOpen"
    :title="pipelineToEdit ? `Editar: ${pipelineToEdit.name}` : 'Nuevo Servicio de Ingesta ETL'"
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
            @click="currentStep = step.num"
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
                v-model="name"
                placeholder="Ej. OpenSky Live Vectors"
                size="sm"
                class="w-full text-xs"
              />
            </div>
            <div>
              <label class="block font-semibold text-text-main mb-1">
                Nombre del Dataset *
              </label>
              <UInput
                v-model="datasetName"
                placeholder="Ej. OpenSky Network API"
                size="sm"
                class="w-full text-xs"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-text-main mb-1">
              Descripción Operativa
            </label>
            <UInput
              v-model="description"
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
                type="button"
                class="p-3 rounded-xl border text-left transition-all cursor-pointer"
                :class="[
                  targetEntity === opt.value
                    ? 'border-primary bg-primary/5 text-primary shadow-xs'
                    : 'border-border-subtle bg-surface-card hover:border-border-hover text-text-main',
                ]"
                @click="targetEntity = opt.value as TargetEntity"
              >
                <span class="font-bold text-xs block mb-1">
                  {{ opt.label }}
                </span>
                <span class="text-[11px] text-text-muted leading-tight block">
                  {{ opt.description }}
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
                v-model="sourceType"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option value="http_stream">HTTP File Stream (CSV/ZIP)</option>
                <option value="rest_api">REST API (JSON)</option>
                <option value="s3_bucket">Bucket S3 / Object Storage</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-text-main mb-1">
                Método HTTP *
              </label>
              <select
                v-model="httpMethod"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-text-main mb-1">
                Formato de Datos *
              </label>
              <select
                v-model="dataFormat"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option value="csv">CSV (Texto separado por coma)</option>
                <option value="json">JSON Array</option>
                <option value="jsonl">JSON Lines (Streaming)</option>
              </select>
            </div>
          </div>

          <!-- URL del Endpoint -->
          <div>
            <label class="block font-semibold text-text-main mb-1">
              URL del Endpoint / Recurso Remoto *
            </label>
            <UInput
              v-model="endpointUrl"
              placeholder="https://api.aviation-feed.com/v1/delays.csv"
              size="sm"
              icon="i-lucide-link"
              class="w-full font-mono text-xs"
            />
            <span class="text-[10px] text-text-dim mt-1 block">
              Soporta interpolación dinámica de variables: {date}, {year}, {month}.
            </span>
          </div>

          <!-- Opciones de CSV / JSON -->
          <div
            v-if="dataFormat === 'csv'"
            class="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border-subtle bg-surface-card"
          >
            <div>
              <label class="block text-[11px] font-semibold text-text-muted mb-1">
                Delimitador CSV:
              </label>
              <UInput
                v-model="csvDelimiter"
                size="xs"
                class="w-24 font-mono text-center text-xs"
              />
            </div>
            <div class="flex items-center pt-4">
              <UCheckbox
                v-model="csvHasHeader"
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
                v-model="hdr.value"
                placeholder="Valor secreto..."
                type="password"
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
            :connection="connectionConfig"
            :probe-result="probeResult"
            :is-loading="isTesting"
            @test-connection="handleTestConnection"
            @apply-detected-columns="handleApplyDetectedColumns"
          />
        </div>

        <!-- ============================================== -->
        <!-- PASO 3: Mapeo Semántico                         -->
        <!-- ============================================== -->
        <div v-show="currentStep === 3" class="space-y-4">
          <EtlSchemaMapper
            v-model="schemaMapping"
            :target-entity="targetEntity"
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
                @click="cronPreset = preset.value as any"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <div v-if="cronPreset === 'custom'">
            <label class="block text-[11px] font-semibold text-text-muted mb-1">
              Expresión Cron Estándar (5 campos):
            </label>
            <UInput
              v-model="customCron"
              placeholder="0 4 * * *"
              size="sm"
              class="w-full font-mono text-xs"
            />
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
                {{ batchSize.toLocaleString() }} filas
              </UBadge>
            </div>

            <UFieldGroup class="w-full flex">
              <UButton
                v-for="s in [1000, 2500, 5000]"
                :key="s"
                :variant="batchSize === s ? 'solid' : 'outline'"
                :color="batchSize === s ? 'primary' : 'neutral'"
                size="xs"
                class="flex-1 justify-center font-mono cursor-pointer"
                @click="batchSize = s"
              >
                {{ s.toLocaleString() }} filas
              </UButton>
            </UFieldGroup>
          </div>

          <!-- Concurrencia y Resiliencia -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-text-muted mb-1">
                Concurrencia de Workers:
              </label>
              <select
                v-model.number="concurrency"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option :value="1">1 worker (Secuencial)</option>
                <option :value="2">2 workers</option>
                <option :value="4">4 workers (Recomendado)</option>
                <option :value="6">6 workers</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-text-muted mb-1">
                Reintentos ante Fallo:
              </label>
              <select
                v-model.number="maxRetries"
                class="w-full rounded-md border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
              >
                <option :value="1">1 reintento</option>
                <option :value="3">3 reintentos (Backoff exp.)</option>
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
