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

