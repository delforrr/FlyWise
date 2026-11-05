export type PipelineStatus = 'idle' | 'running' | 'pausado' | 'error' | 'success';

export type StandardPipelineId = 'ourairports' | 'openflights' | 'bts-transtats' | 'anac';
export type PipelineId = StandardPipelineId | (string & {});

export type IngestionSourceType = 'http_stream';
export type IngestionDataFormat = 'csv';
export type TargetEntity = 'paises' | 'aeropuertos' | 'aerolineas' | 'rutas' | 'otp_metrics';

export interface FieldMappingRule {
  columnaOrigen: string;
  campoDestino: string;
  transform?: 'none' | 'uppercase' | 'trim' | 'to_number' | 'to_boolean';
  required?: boolean;
}

export interface TargetFieldDef {
  key: string;
  label: string;
  descripcion: string;
  required: boolean;
  type: string;
}

export const TARGET_FIELDS_CATALOG: Record<TargetEntity, TargetFieldDef[]> = {
paises: [
{ key: "nombre", label: "Nombre", descripcion: "Nombre del país.", required: true, type: "string" },
{ key: "codigoIso", label: "ISO", descripcion: "Código ISO opcional.", required: false, type: "string" }
],
aeropuertos: [
{ key: "idOpenflights", label: "ID OpenFlights", descripcion: "Identificador externo, no UUID interno.", required: true, type: "number" },
{ key: "nombre", label: "Nombre", descripcion: "Nombre original del catálogo.", required: true, type: "string" },
{ key: "ciudad", label: "ciudad", descripcion: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "nombrePais", label: "nombrePais", descripcion: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "iata", label: "iata", descripcion: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "icao", label: "icao", descripcion: "Opcional salvo coordenadas.", required: false, type: "string" },
{ key: "latitud", label: "latitud", descripcion: "Opcional salvo coordenadas.", required: true, type: "number" },
{ key: "longitud", label: "longitud", descripcion: "Opcional salvo coordenadas.", required: true, type: "number" },
{ key: "fuente", label: "fuente", descripcion: "Opcional salvo coordenadas.", required: false, type: "string" }
],
aerolineas: [
{ key: "idOpenflights", label: "ID OpenFlights", descripcion: "Identificador externo, no UUID interno.", required: true, type: "number" },
{ key: "nombre", label: "Nombre", descripcion: "Nombre original del catálogo.", required: true, type: "string" },
{ key: "iata", label: "iata", descripcion: "Dato opcional del catálogo.", required: false, type: "string" },
{ key: "icao", label: "icao", descripcion: "Dato opcional del catálogo.", required: false, type: "string" },
{ key: "pais", label: "pais", descripcion: "Dato opcional del catálogo.", required: false, type: "string" },
{ key: "activa", label: "activa", descripcion: "Dato opcional del catálogo.", required: false, type: "boolean" }
],
rutas: [
{ key: "idOpenflightsOrigen", label: "idOpenflightsOrigen", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" },
{ key: "codigoOrigen", label: "codigoOrigen", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "string" },
{ key: "idOpenflightsDestino", label: "idOpenflightsDestino", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" },
{ key: "codigoDestino", label: "codigoDestino", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "string" },
{ key: "idOpenflightsAerolinea", label: "idOpenflightsAerolinea", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" },
{ key: "codigoAerolinea", label: "codigoAerolinea", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "string" },
{ key: "codigoCompartido", label: "codigoCompartido", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "boolean" },
{ key: "escalas", label: "escalas", descripcion: "ID OpenFlights o código externo; no UUID.", required: false, type: "number" }
],
otp_metrics: [

],
};

export interface PipelineHeader {
  key: string;
  referenciaCredencial: string;
}

export interface PipelineConnectionConfig {
  tipoFuente: IngestionSourceType;
  urlEndpoint: string;
  metodoHttp: 'GET';
  headers?: PipelineHeader[];
  formatoDatos: IngestionDataFormat;
  separadorCsv?: string;
  csvConCabecera?: boolean;
}

export interface PipelineScheduleConfig {
  expresionCron: string;
  tamanoLote: number; // Forzado a 1.000 - 5.000 filas por RNF-04
  tiempoLimiteSegundos: number;
  maximoReintentos: number;
}

export interface ProbeEndpointResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  contentType: string;
  sampleRows: Record<string, unknown>[];
  detectedColumns: string[];
  mensajeError?: string;
  estimatedTotalSize?: string;
}

export interface DiscardedRowRecord {
  intento?: number;
  id: string;
  numeroFila: number;
  muestraOriginal: string;
  motivo: string;
  campo: string;
  timestamp: string;
}

export interface ProcesoEtl {
  intento?: number;
  id: PipelineId;
  latestJobId?: string;
  pausado?: boolean;
  nombre: string;
  nombreConjunto: string;
  descripcion: string;
  icon: string;
  estado: PipelineStatus;
  progressPercent: number;
  filasProcesadas: number;
  totalEstimatedRows: number;
  filasDescartadas: number;
  lastSyncAt: string | null;
  nextScheduledSync: string;
  scheduleDescription: string;
  averageSpeedRowsPerSec: number;
  currentStepMessage?: string;
  muestrasDescartadas: DiscardedRowRecord[];
  // Propiedades añadidas para configuración extensible y personalizada
  esSistema?: boolean;
  entidadDestino?: TargetEntity;
  conexion?: PipelineConnectionConfig;
  mapeoEsquema?: FieldMappingRule[];
  configuracionProgramacion?: PipelineScheduleConfig;
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
  intento?: number;
  id: string;
  timestamp: string;
  procesoId: PipelineId;
  pipelineName: string;
  nivel: 'info' | 'success' | 'warn' | 'error';
  mensaje: string;
  detail?: string;
}

export interface TriggerSyncOptions {
  procesoId: PipelineId;
}

export type Pipeline = ProcesoEtl;
export type LogEntry = EtlLogEntry;


export interface EtlJobRecord {
  intento?: number;
  id: string;
  procesoId: string | null;
  fuente: string;
  estado: 'pending' | 'running' | 'completed' | 'failed';
  filasTotales: number;
  filasProcesadas: number;
  filasInsertadas: number;
  filasDescartadas: number;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  mensajeError: string | null;
  durationMs: number | null;
}
export type StoredPipeline = Pick<ProcesoEtl, 'id' | 'nombre' | 'nombreConjunto' | 'descripcion' | 'entidadDestino' | 'esSistema' | 'conexion' | 'mapeoEsquema' | 'configuracionProgramacion'> & { pausado: boolean };
