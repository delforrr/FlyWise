export type PipelineStatus = 'idle' | 'running' | 'paused' | 'error' | 'success';

export type PipelineId = 'ourairports' | 'openflights' | 'bts-transtats' | 'anac';

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
