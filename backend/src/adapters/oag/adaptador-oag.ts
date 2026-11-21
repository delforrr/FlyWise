import type {
  AdaptadorOperaciones,
  FilaOperacion,
} from '../../ingestion/application/adaptador-operaciones.js';
import {
  normalizarVueloOag,
  paginasOag,
  OAG_CLAVE_ENTORNO,
} from './flight-info.js';
import {
  FalloOag,
  type CursorOag,
  type LecturaOag,
  type OperacionOag,
} from '../../ingestion/application/oag/alcance-oag.js';

export const ADAPTADOR_OAG = Symbol('ADAPTADOR_OAG');

export class AdaptadorOag implements AdaptadorOperaciones<
  LecturaOag,
  OperacionOag,
  CursorOag
> {
  constructor(
    private readonly obtenerClave = () => process.env[OAG_CLAVE_ENTORNO],
  ) {}

  async *leerLotes({
    consulta,
    cursores,
    filasPrevias,
    totalEsperado,
  }: LecturaOag) {
    const clave = this.obtenerClave()?.trim();
    if (!clave)
      throw new FalloOag('OAG no cuenta con una credencial configurada');
    for await (const { filas, cursor, totalEsperado: total } of paginasOag(
      consulta,
      clave,
      cursores,
      filasPrevias,
      totalEsperado,
    )) {
      yield {
        cursor: cursor ? { valor: cursor, totalEsperado: total } : null,
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
