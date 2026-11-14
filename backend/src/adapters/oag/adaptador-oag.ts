import type {
  AdaptadorOperaciones,
  FilaOperacion,
} from '../../ingestion/application/adaptador-operaciones.js';
import {
  normalizarVueloOag,
  paginasOag,
  type ConsultaOag,
} from './flight-info.js';

export type OperacionOag = Exclude<
  ReturnType<typeof normalizarVueloOag>,
  string | null
>;

export type LecturaOag = {
  consulta: ConsultaOag;
  clave: string;
  cursores: string[];
};
export const ADAPTADOR_OAG = Symbol('ADAPTADOR_OAG');

export class AdaptadorOag implements AdaptadorOperaciones<
  LecturaOag,
  OperacionOag
> {
  async *leerLotes({ consulta, clave, cursores }: LecturaOag) {
    for await (const { filas, cursor } of paginasOag(
      consulta,
      clave,
      cursores,
    )) {
      yield {
        cursor,
        filas: filas.map((original): FilaOperacion<OperacionOag> => {
          const operacion = normalizarVueloOag(original, consulta);
          if (operacion === 'fuera-de-poblacion') return { tipo: operacion };
          if (!operacion)
            return {
              tipo: 'descarte',
              causa: 'formato',
              motivo: 'Fila OAG inválida',
              original,
            };
          return { tipo: 'operacion', operacion };
        }),
      };
    }
  }
}
