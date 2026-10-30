export type PipelineStatus = 'idle' | 'running' | 'paused' | 'error' | 'success';

export type StandardPipelineId = 'ourairports' | 'openflights' | 'bts-transtats' | 'anac';
export type PipelineId = StandardPipelineId | (string & {});

export type IngestionSourceType = 'http_stream';
export type IngestionDataFormat = 'csv';
export type TargetEntity = 'countries' | 'airports' | 'airlines' | 'routes' | 'otp_metrics';

export interface FieldMappingRule {
  sourceColumn: string;
  targetField: string;
  transform?: 'none' | 'uppercase' | 'trim' | 'to_number' | 'to_boolean';
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
countries: [
{ key: "name", label: "Nombre", description: "Nombre del país.", required: true, type: "string" },
{ key: "isoCode", label: "ISO", description: "Código ISO opcional.", required: false, type: "string" }
],
airports: [
{ key: "openflightsId", label: "ID OpenFlights", description: "Identificador externo, no UUID interno.", required: true, type: "number" },
{ key: "name", label: "Nombre", description: "Nombre original del catálogo.", required: true, type: "string" },
{ key: "city", label: "city", description: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "countryName", label: "countryName", description: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "iata", label: "iata", description: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "icao", label: "icao", description: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "latitude", label: "latitude", description: "Opcional salvo coordenadas.", required: true, type: "number" },
{ key: "longitude", label: "longitude", description: "Opcional salvo coordenadas.", required: true, type: "number" },
{ key: "source", label: "source", description: "Opcional salvo coordenadas.", required: false, type: "string" }
],
airlines: [
{ key: "openflightsId", label: "ID OpenFlights", description: "Identificador externo, no UUID interno.", required: true, type: "number" },
{ key: "name", label: "Nombre", description: "Nombre original del catálogo.", required: true, type: "string" },
{ key: "iata", label: "iata", description: "Dato opcional del catálogo.", required: false, type: "string" },
{ key: "icao", label: "icao", description: "Dato opcional del catálogo.", required: false, type: "string" },
{ key: "country", label: "country", description: "Dato opcional del catálogo.", required: false, type: "string" },
{ key: "active", label: "active", description: "Dato opcional del catálogo.", required: false, type: "boolean" }
],
routes: [
{ key: "originOpenflightsId", label: "originOpenflightsId", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" },
{ key: "originCode", label: "originCode", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "string" },
{ key: "destinationOpenflightsId", label: "destinationOpenflightsId", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" },
{ key: "destinationCode", label: "destinationCode", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "string" },
{ key: "airlineOpenflightsId", label: "airlineOpenflightsId", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" },
{ key: "airlineCode", label: "airlineCode", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "string" },
{ key: "codeshare", label: "codeshare", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "boolean" },
{ key: "stops", label: "stops", description: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" }
],
otp_metrics: [

],
};

export interface PipelineHeader {
  key: string;
  credentialRef: string;
}

export interface PipelineConnectionConfig {
  sourceType: IngestionSourceType;
  endpointUrl: string;
  httpMethod: 'GET';
  headers?: PipelineHeader[];
  dataFormat: IngestionDataFormat;
  csvDelimiter?: string;
  csvHasHeader?: boolean;
}

export interface PipelineScheduleConfig {
  cronExpression: string;
  batchSize: number; // Forzado a 1.000 - 5.000 filas por RNF-04
  timeoutSeconds: number;
  maxRetries: number;
}

export interface ProbeEndpointResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  contentType: string;
  sampleRows: Record<string, unknown>[];
  detectedColumns: string[];
  errorMessage?: string;
  estimatedTotalSize?: string;
}

export interface DiscardedRowRecord {
  attempt?: number;
  id: string;
  rowIndex: number;
  rawSample: string;
  reason: string;
  field: string;
  timestamp: string;
}

export interface EtlPipeline {
  attempt?: number;
  id: PipelineId;
  latestJobId?: string;
  paused?: boolean;
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
  attempt?: number;
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
}

export type Pipeline = EtlPipeline;
export type LogEntry = EtlLogEntry;


export interface EtlJobRecord {
  attempt?: number;
  id: string;
  pipelineId: string | null;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  discardedRows: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  durationMs: number | null;
}
export type StoredPipeline = Pick<EtlPipeline, 'id' | 'name' | 'datasetName' | 'description' | 'targetEntity' | 'isSystem' | 'connection' | 'schemaMapping' | 'scheduleConfig'> & { paused: boolean };
