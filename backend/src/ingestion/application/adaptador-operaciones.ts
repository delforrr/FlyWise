import type { Operacion } from '../../entities/vuelos/domain/operacion.js';

export type EvidenciaOperacion = Pick<Operacion, 'demoraLlegadaMinutos'> & {
  estado: Operacion['estado'] | null;
};

export type FilaOperacion<T extends EvidenciaOperacion> =
  | { tipo: 'operacion'; operacion: T }
  | {
      tipo: 'descarte';
      motivo: string;
      original: unknown;
      causa: 'identidad' | 'formato' | 'elegibilidad';
    }
  | { tipo: 'fuera-de-poblacion' };

export interface LoteOperaciones<T extends EvidenciaOperacion> {
  filas: readonly FilaOperacion<T>[];
  cursor?: string | null;
}

export interface AdaptadorOperaciones<Alcance, T extends EvidenciaOperacion> {
  leerLotes(alcance: Alcance): AsyncIterable<LoteOperaciones<T>>;
}
