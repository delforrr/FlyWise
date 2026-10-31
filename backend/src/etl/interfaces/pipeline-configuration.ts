// Persist references, never literal credentials from the UI's conexion form.
export type PipelineConnectionConfig = {
  tipoFuente: 'http_stream';
  urlEndpoint: string;
  metodoHttp: 'GET';
  headers?: { key: string; referenciaCredencial: string }[];
  formatoDatos: 'csv';
  separadorCsv?: string;
  csvConCabecera?: boolean;
};

export type FieldMappingRule = {
  columnaOrigen: string;
  campoDestino: string;
  transform?: 'none' | 'uppercase' | 'trim' | 'to_number' | 'to_boolean';
  required?: boolean;
};

export type PipelineScheduleConfig = {
  expresionCron: string;
  tamanoLote: number;
  tiempoLimiteSegundos: number;
  maximoReintentos: number;
};

export type PipelineConfiguration = {
  conexion: PipelineConnectionConfig;
  mapeoEsquema: FieldMappingRule[];
  configuracionProgramacion: PipelineScheduleConfig;
};

export const MAX_DISCARDED_SAMPLES_PER_JOB = 100;
