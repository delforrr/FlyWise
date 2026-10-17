export type PipelineStatus = 'idle' | 'running' | 'paused' | 'error' | 'success';

export type StandardPipelineId = 'ourairports' | 'openflights' | 'bts-transtats' | 'anac';
export type PipelineId = StandardPipelineId | (string & {});

export type IngestionSourceType = 'http_stream' | 'rest_api' | 's3_bucket';
export type IngestionDataFormat = 'csv' | 'json' | 'jsonl';
export type TargetEntity = 'airports' | 'routes' | 'otp_metrics';

export interface FieldMappingRule {
  sourceColumn: string;
  targetField: string;
  transform?: 'none' | 'uppercase' | 'trim' | 'to_number' | 'to_boolean' | 'srid_4326_point';
  required?: boolean;
}

export interface TargetFieldDef {
  key: string;
  label: string;
  description: string;
  required: boolean;
  type: string;
}

export const TARGET_FIELDS_CATALOG: Record<TargetEntity, TargetFieldDef[]> = {
  airports: [
    {
      key: 'icaoCode',
      label: 'Código ICAO',
      description: 'Identificador oficial de 4 letras (ej. SAEZ, KJFK).',
      required: true,
      type: 'string',
    },
    {
      key: 'iataCode',
      label: 'Código IATA',
      description: 'Identificador comercial de 3 letras (ej. EZE, JFK).',
      required: false,
      type: 'string',
    },
    {
      key: 'name',
      label: 'Nombre del Aeropuerto',
      description: 'Denominación pública oficial.',
      required: true,
      type: 'string',
    },
    {
      key: 'latitude',
      label: 'Latitud (SRID 4326)',
      description: 'Coordenada decimal [-90, 90].',
      required: true,
      type: 'number',
    },
    {
      key: 'longitude',
      label: 'Longitud (SRID 4326)',
      description: 'Coordenada decimal [-180, 180].',
      required: true,
      type: 'number',
    },
    {
      key: 'elevation',
      label: 'Elevación (Pies/Metros)',
      description: 'Altitud de la pista respecto al nivel del mar.',
      required: false,
      type: 'number',
    },
  ],
  routes: [
    {
      key: 'routeId',
      label: 'ID de Conexión / Tramo',
      description: 'Identificador del par de ruta o segmento.',
      required: true,
      type: 'string',
    },
    {
      key: 'originId',
      label: 'Aeropuerto Origen',
      description: 'Código IATA o ICAO del nodo origen.',
      required: true,
      type: 'string',
    },
    {
      key: 'destinationId',
      label: 'Aeropuerto Destino',
      description: 'Código IATA o ICAO del nodo destino.',
      required: true,
      type: 'string',
    },
    {
      key: 'airlineId',
      label: 'Aerolínea Operadora',
      description: 'Código comercial o designador OACI.',
      required: true,
      type: 'string',
    },
    {
      key: 'aircraftType',
      label: 'Tipo de Aeronave',
      description: 'Modelo de avión asignado (ej. B738, A320).',
      required: false,
      type: 'string',
    },
  ],
  otp_metrics: [
    {
      key: 'flightId',
      label: 'Identificador de Vuelo',
      description: 'Clave única del registro o número de vuelo.',
      required: true,
      type: 'string',
    },
    {
      key: 'originId',
      label: 'Origen (Tupla OTP)',
      description: 'Nodo de salida para la tupla analítica.',
      required: true,
      type: 'string',
    },
    {
      key: 'destinationId',
      label: 'Destino (Tupla OTP)',
      description: 'Nodo de arribo para la tupla analítica.',
      required: true,
      type: 'string',
    },
    {
      key: 'airlineId',
      label: 'Aerolínea (Tupla OTP)',
      description: 'Compañía responsable del itinerario.',
      required: true,
      type: 'string',
    },
    {
      key: 'delayMinutes',
      label: 'Demora en Minutos',
      description: 'Retraso de arribo en minutos (cálculo OTP-15).',
      required: true,
      type: 'number',
    },
    {
      key: 'isCancelled',
      label: 'Indicador de Cancelación',
      description: 'Bandera booleana de cancelación del vuelo.',
      required: false,
      type: 'boolean',
    },
  ],
};

export interface PipelineHeader {
  key: string;
  value: string;
}

export interface PipelineQueryParam {
  key: string;
  value: string;
}

export interface PipelineConnectionConfig {
  sourceType: IngestionSourceType;
  endpointUrl: string;
  httpMethod: 'GET' | 'POST';
  headers?: PipelineHeader[];
  queryParams?: PipelineQueryParam[];
  dataFormat: IngestionDataFormat;
  csvDelimiter?: string;
  csvHasHeader?: boolean;
  rootJsonPath?: string;
}

export interface PipelineScheduleConfig {
  cronPreset: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpression: string;
  scheduleDescription: string;
  batchSize: number; // Forzado a 1.000 - 5.000 filas por RNF-04
  concurrency: number;
  timeoutSeconds: number;
  maxRetries: number;
}

export interface ProbeEndpointResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  contentType: string;
  sampleRows: Record<string, any>[];
  detectedColumns: string[];
  errorMessage?: string;
  estimatedTotalSize?: string;
}

export interface DiscardedRowRecord {
  id: string;
  rowIndex: number;
  rawSample: string;
  reason: string;
  field: string;
  timestamp: string;
  resolved?: boolean;
}

export interface EtlPipeline {
  id: PipelineId;
  name: string;
  datasetName: string;
  description: string;
  icon: string;
  status: PipelineStatus;
  progressPercent: number;
  processedRows: number;
  totalEstimatedRows: number;
  discardedRows: number;
  lastSyncAt: string | null;
  nextScheduledSync: string;
  scheduleDescription: string;
  averageSpeedRowsPerSec: number;
  currentStepMessage?: string;
  discardedSamples: DiscardedRowRecord[];
  // Propiedades añadidas para configuración extensible y personalizada
  isSystem?: boolean;
  targetEntity?: TargetEntity;
  connection?: PipelineConnectionConfig;
  schemaMapping?: FieldMappingRule[];
  scheduleConfig?: PipelineScheduleConfig;
}

export interface EtlGlobalMetrics {
  totalAeroRecords: number;
  activeJobsCount: number;
  totalDiscardedCount: number;
  successRatePercent: number;
  systemHealth: 'optimal' | 'syncing' | 'attention_needed';
  lastGlobalSync: string;
}

export interface EtlLogEntry {
  id: string;
  timestamp: string;
  pipelineId: PipelineId;
  pipelineName: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export interface TriggerSyncOptions {
  pipelineId: PipelineId;
  mode: 'incremental' | 'full';
  dryRun: boolean;
  batchSize: number;
}

export type Pipeline = EtlPipeline;
export type LogEntry = EtlLogEntry;

