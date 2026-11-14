import { pipeline, type Readable } from 'node:stream';
import csv from 'csv-parser';
import type {
  AdaptadorOperaciones,
  FilaOperacion,
} from '../../ingestion/application/adaptador-operaciones.js';
import {
  normalizarBts,
  type FilaBts,
  type OperacionBts,
} from './operacion-bts.js';

export type LecturaBts = {
  periodo: string;
  source: Readable | (() => Promise<Readable>);
  registrarBytes(this: void, chunk: Buffer | string): void;
};
export const ADAPTADOR_BTS = Symbol('ADAPTADOR_BTS');

export class AdaptadorBts implements AdaptadorOperaciones<
  LecturaBts,
  OperacionBts
> {
  async *leerLotes({ periodo, source, registrarBytes }: LecturaBts) {
    const input = typeof source === 'function' ? await source() : source;
    const registros = csv({ maxRowBytes: 65536 });
    input.on('data', registrarBytes);
    pipeline(input, registros, (error) => {
      if (error) registros.destroy(error);
    });
    let numeroFila = 0;
    let filas: FilaOperacion<OperacionBts>[] = [];
    try {
      for await (const raw of registros) {
        const original = raw as FilaBts;
        const resultado = normalizarBts(original, periodo, ++numeroFila);
        filas.push(
          'causa' in resultado
            ? { tipo: 'descarte', ...resultado, original }
            : { tipo: 'operacion', operacion: resultado },
        );
        if (filas.length === 1000) {
          yield { filas };
          filas = [];
        }
      }
      if (filas.length) yield { filas };
    } finally {
      registros.destroy();
      input.off('data', registrarBytes);
    }
  }
}
