// Persist references, never literal credentials from the UI's connection form.
export type PipelineConnectionConfig = {
  sourceType: 'http_stream';
  endpointUrl: string;
  httpMethod: 'GET';
  headers?: { key: string; credentialRef: string }[];
  dataFormat: 'csv';
  csvDelimiter?: string;
  csvHasHeader?: boolean;
};

export type FieldMappingRule = {
  sourceColumn: string;
  targetField: string;
  transform?: 'none' | 'uppercase' | 'trim' | 'to_number' | 'to_boolean';
  required?: boolean;
};

export type PipelineScheduleConfig = {
  cronExpression: string;
  batchSize: number;
  timeoutSeconds: number;
  maxRetries: number;
};

export type PipelineConfiguration = {
  connection: PipelineConnectionConfig;
  schemaMapping: FieldMappingRule[];
  scheduleConfig: PipelineScheduleConfig;
};

export const MAX_DISCARDED_SAMPLES_PER_JOB = 100;
