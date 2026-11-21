import type {
  HorariosOperacion,
  ObservacionVuelo,
} from '../../../entities/vuelos/domain/operacion.js';
import type { EvidenciaOperacion } from '../adaptador-operaciones.js';
import type { VueloResuelto } from './preparar-publicacion-oag.js';

export type Codigos = { iata?: string; icao?: string };
export type ConsultaOag = {
  periodo: string;
  origenCodigo: string;
  destinoCodigo: string;
  tipoCodigo: 'IATA' | 'ICAO';
};
export type LecturaOag = {
  consulta: ConsultaOag;
  cursores: string[];
  filasPrevias?: number;
  totalEsperado?: number;
};
export type CursorOag = { valor: string; totalEsperado?: number };
export type OperacionOag = EvidenciaOperacion & {
  id: string;
  carrier: Codigos;
  fechaVuelo: string;
  numeroVuelo: string;
  horarios: HorariosOperacion;
  revision: number;
};

export class FalloOag extends Error {}

export type ParametrosTramoOag = {
  origenId: string;
  destinoId: string;
  periodo: string;
  coberturaMinimaPct: number;
};
export type TramoOag = ParametrosTramoOag &
  ConsultaOag & {
    autorizarCambioFuente?: string[];
  };
export type AlcanceOag = TramoOag & {
  otrosTramos?: TramoOag[];
  checkpoint?: CheckpointOag;
};
export type ProgresoOag = {
  total: number;
  descartadas: number;
  paginas: number;
};
export type CheckpointOag = {
  cursores: string[];
  totalEsperado?: number;
  total: number;
  descartadas: number;
  candidatos: [string, VueloResuelto][];
};
export type TramoLeido = {
  alcance: TramoOag;
  observaciones: ObservacionVuelo[];
  totalesPorOperadora: Record<string, number>;
};
export type AvanceOag = {
  preparados: TramoLeido[];
  progreso: ProgresoOag;
  pagina?: CheckpointOag;
};

export function alcanceDe(snapshot: unknown) {
  return (snapshot as { conexion?: AlcanceOag } | null)?.conexion;
}
