import type { AdaptadorOperaciones } from '../adaptador-operaciones.js';
import { ingerirOperaciones } from '../ingesta-operaciones.js';
import {
  FalloOag,
  type Codigos,
  type AlcanceOag,
  type AvanceOag,
  type CheckpointOag,
  type CursorOag,
  type LecturaOag,
  type OperacionOag,
  type ProgresoOag,
  type TramoLeido,
  type TramoOag,
} from './alcance-oag.js';
import {
  prepararPublicacionOag,
  type VueloResuelto,
} from './preparar-publicacion-oag.js';

const MAX_FILAS = 10_000;
const MAX_PAGINAS = 1000;

function combinarRevision(actual: VueloResuelto, previa?: VueloResuelto) {
  if (!previa) return actual;
  const reemplazar =
    actual.revision > previa.revision ||
    (actual.revision === previa.revision &&
      actual.estado !== null &&
      (previa.estado === null ||
        (actual.estado === 'ARRIVED' &&
          previa.estado === 'ARRIVED' &&
          previa.demoraLlegadaMinutos === null &&
          actual.demoraLlegadaMinutos !== null)));
  const [principal, secundaria] = reemplazar
    ? [actual, previa]
    : [previa, actual];
  if (
    !principal.horarios ||
    !secundaria.horarios ||
    principal.fechaVuelo !== secundaria.fechaVuelo ||
    principal.numeroVuelo !== secundaria.numeroVuelo ||
    principal.estado !== secundaria.estado
  )
    return principal;
  const a = principal.horarios;
  const b = secundaria.horarios;
  return {
    ...principal,
    horarios: {
      ...a,
      ...(a.salidaProgramadaUtc === null && b.salidaProgramadaUtc !== null
        ? {
            salidaProgramadaUtc: b.salidaProgramadaUtc,
            desfaseOrigenMinutos: b.desfaseOrigenMinutos,
            evidenciaFecha: b.evidenciaFecha,
          }
        : {}),
      salidaRealUtc: a.salidaRealUtc ?? b.salidaRealUtc,
      llegadaProgramadaUtc: a.llegadaProgramadaUtc ?? b.llegadaProgramadaUtc,
      llegadaRealUtc: a.llegadaRealUtc ?? b.llegadaRealUtc,
    },
    demoraLlegadaMinutos:
      principal.demoraLlegadaMinutos ?? secundaria.demoraLlegadaMinutos,
  };
}

export interface RepositorioCargaOag {
  resolverAerolinea(codigos: Codigos): Promise<string | null>;
  // Confirma las observaciones y listaParaPublicar en la misma transacción.
  guardar(
    id: string,
    intento: number,
    tramos: TramoLeido[],
    progreso: ProgresoOag,
  ): Promise<void>;
}

export interface ContinuacionCargaOag {
  anterior?: AvanceOag;
  guardar(avance: AvanceOag): Promise<void>;
}

export class CargarOag {
  constructor(
    private readonly adaptador: AdaptadorOperaciones<
      LecturaOag,
      OperacionOag,
      CursorOag
    >,
    private readonly repositorio: RepositorioCargaOag,
  ) {}

  async ejecutar(
    id: string,
    intento: number,
    alcance: AlcanceOag,
    progreso: ProgresoOag,
    continuacion: ContinuacionCargaOag,
  ) {
    const tramos = [alcance, ...(alcance.otrosTramos ?? [])];
    const preparados = [...(continuacion.anterior?.preparados ?? [])];
    const pagina =
      continuacion.anterior?.pagina ??
      (tramos.length === 1 ? alcance.checkpoint : undefined);
    Object.assign(progreso, continuacion.anterior?.progreso);
    for (const [indice, tramo] of tramos.slice(preparados.length).entries()) {
      const progresoPrevio = { ...progreso };
      preparados.push(
        await this.leerTramo(
          tramo,
          progreso,
          indice === 0 ? pagina : undefined,
          (pagina) =>
            continuacion.guardar({
              preparados,
              progreso: progresoPrevio,
              pagina,
            }),
        ),
      );
      // Conserva los tramos ya leídos y permite reintentar la persistencia final.
      await continuacion.guardar({ preparados, progreso });
    }
    await this.repositorio.guardar(id, intento, preparados, progreso);
  }

  private async leerTramo(
    alcance: TramoOag,
    progreso: ProgresoOag,
    checkpoint: CheckpointOag | undefined,
    continuar: (checkpoint: CheckpointOag) => Promise<void>,
  ): Promise<TramoLeido> {
    const cursores = [...(checkpoint?.cursores ?? [])];
    let total = checkpoint?.total ?? 0;
    let descartadas = checkpoint?.descartadas ?? 0;
    progreso.total += total;
    progreso.descartadas += descartadas;
    progreso.paginas += cursores.length;
    const candidatos = new Map(checkpoint?.candidatos);
    const aerolineas = new Map<string, Promise<string | null>>();
    await ingerirOperaciones(
      this.adaptador,
      {
        consulta: alcance,
        cursores,
        filasPrevias: total,
        totalEsperado: checkpoint?.totalEsperado,
      },
      {
        iniciarLote({ filas }) {
          progreso.paginas++;
          total += filas.length;
          progreso.total += filas.length;
          if (progreso.total > MAX_FILAS || progreso.paginas > MAX_PAGINAS)
            throw new FalloOag('OAG excedió el límite de esta corrida');
        },
        procesarFila: async (fila) => {
          if (fila.tipo === 'fuera-de-poblacion') return;
          if (fila.tipo === 'descarte') {
            descartadas++;
            progreso.descartadas++;
            return;
          }
          const normalizada = fila.operacion;
          const { carrier, ...vuelo } = normalizada;
          const codigo = JSON.stringify([carrier.iata, carrier.icao]);
          let resolucion = aerolineas.get(codigo);
          if (!resolucion) {
            resolucion = this.repositorio.resolverAerolinea(carrier);
            aerolineas.set(codigo, resolucion);
          }
          const aerolineaId = await resolucion;
          if (!aerolineaId) {
            descartadas++;
            progreso.descartadas++;
            return;
          }
          const claveOperacion = JSON.stringify([aerolineaId, normalizada.id]);
          candidatos.set(
            claveOperacion,
            combinarRevision(
              { ...vuelo, aerolineaId },
              candidatos.get(claveOperacion),
            ),
          );
        },
        async terminarLote({ cursor }) {
          if (cursor) {
            cursores.push(cursor.valor);
            await continuar({
              cursores,
              totalEsperado: cursor.totalEsperado,
              total,
              descartadas,
              candidatos: [...candidatos],
            });
          }
        },
      },
    );

    const preparada = prepararPublicacionOag(
      candidatos.values(),
      alcance,
      descartadas,
    );
    if (preparada.tipo !== 'lista') {
      progreso.descartadas += preparada.descartadas - descartadas;
      if (preparada.tipo === 'invalida') throw preparada.error;
      return { alcance, observaciones: [], totalesPorOperadora: {} };
    }
    return { alcance, ...preparada };
  }
}
