import { not } from '@prisma/orm-postgres/orm-client';
import { ultimoDiaDelMes } from '../../prisma/timestamp.js';
import { admiteFuente } from '../../metrics/domain/autoridad-publicacion.js';
import {
  prepararPublicacionOag,
  type VueloResuelto,
} from './preparar-publicacion-oag.js';
import {
  exigirIngestaDisponible,
  exigirServicioDisponible,
  type ServicioAdmitido,
} from '../../ingestion/infrastructure/admision-operaciones.js';
import type { AdaptadorOperaciones } from '../../ingestion/application/adaptador-operaciones.js';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ConfiguracionOagDto } from './oag.controller.js';
import {
  bloquearCambiosMetricas,
  leerPublicacionesDelTramo,
} from '../../metrics/publicacion.store.js';
import { publicarPoblacionesCandidatas } from '../../metrics/poblaciones-candidatas.store.js';
import { periodosCerradosMapa } from '../../metrics/periodos-mapa.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Transaction } from '../../prisma/db.js';
import { guardarObservaciones } from '../../vuelos/observaciones.store.js';
import {
  CredencialOagRechazada,
  CuotaOagAgotada,
  FalloOag,
  OAG_CLAVE_ENTORNO,
  OAG_ENDPOINT,
  type Codigos,
  type ConsultaOag,
} from './flight-info.js';

import {
  ADAPTADOR_OAG,
  type LecturaOag,
  type OperacionOag,
} from './adaptador-oag.js';
import { ingerirOperaciones } from '../../ingestion/application/ingesta-operaciones.js';

export const OAG_QUEUE = 'oag-queue';
const PROCESO_ID = '00000000-0000-4000-8000-000000000020';
const fuente = 'OAG';
const configuracionInicial: ConfiguracionOagDto = {
  origenId: '',
  destinoId: '',
  periodo: '',
  coberturaMinimaPct: 90,
  pausado: true,
};
const ahora = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
const MAX_FILAS = 10_000;
const MAX_PAGINAS = 1000;
const LOTE = 1000;
type TramoOag = Omit<ConfiguracionOagDto, 'pausado'> &
  ConsultaOag & {
    autorizarCambioFuente?: string[];
  };
type AlcanceOag = TramoOag & {
  otrosTramos?: TramoOag[];
  checkpoint?: CheckpointOag;
};
type ProgresoOag = { total: number; descartadas: number; paginas: number };
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

type CheckpointOag = {
  cursores: string[];
  total: number;
  descartadas: number;
  candidatos: [string, VueloResuelto][];
};
type TrabajoOag = {
  ejecucionId: string;
  checkpoint?: CheckpointOag;
  reintentarDesde?: number;
};

@Injectable()
export class OagService implements OnModuleInit {
  private readonly logger = new Logger(OagService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OAG_QUEUE) private readonly queue: Queue<TrabajoOag>,
    @Inject(ADAPTADOR_OAG)
    private readonly adaptador: AdaptadorOperaciones<LecturaOag, OperacionOag>,
  ) {}

  async onModuleInit() {
    await this.queue.setGlobalConcurrency(1);
    await this.prisma.models.ProcesoEtl.createAndCount(
      [
        {
          id: PROCESO_ID,
          nombre: 'OAG Flight Info v2',
          nombreConjunto: 'Operaciones de vuelos',
          entidadDestino: 'otp_metrics',
          esSistema: true,
          pausado: true,
          conexion: {
            ...configuracionInicial,
            claveEntorno: OAG_CLAVE_ENTORNO,
          },
          mapeoEsquema: [],
          configuracionProgramacion: {},
        },
      ],
      { onConflict: 'skip' },
    );
    await this.queue.upsertJobScheduler(
      'recuperar-oag',
      { every: 5000 },
      { name: 'recuperar', opts: { removeOnComplete: 10, removeOnFail: 10 } },
    );
    await this.recuperar();
  }

  async recuperar() {
    let cursor = '';
    for (;;) {
      const pendientes = await this.prisma.models.EjecucionEtl.where({ fuente })
        .where((row) => row.estado.in(['pending', 'running']))
        .where((row) => row.id.gt(cursor))
        .orderBy((row) => row.id.asc())
        .limit(100)
        .all();
      for (const pendiente of pendientes) {
        if (pendiente.listaParaPublicar) {
          try {
            await this.publicar(pendiente.id, pendiente.intento);
          } catch (error) {
            await this.prisma.models.EjecucionEtl.where({
              id: pendiente.id,
              intento: pendiente.intento,
              listaParaPublicar: true,
            }).update({
              mensajeError: 'OAG: publicación pendiente de reintento',
            });
            this.logger.error(`OAG ${pendiente.id}: falló la promoción`, error);
          }
          continue;
        }
        const job = await this.queue.getJob(pendiente.id);
        const estado = await job?.getState();
        if (!job) await this.encolar(pendiente.id);
        else if (estado === 'failed' || estado === 'completed')
          await this.fallar(
            pendiente.id,
            pendiente.intento,
            'OAG se interrumpió. Podés reintentar la ejecución.',
            pendiente.filasTotales,
            pendiente.filasDescartadas,
          );
      }
      if (pendientes.length < 100) break;
      cursor = pendientes[pendientes.length - 1].id;
    }
  }

  async configuracion(): Promise<ConfiguracionOagDto> {
    const proceso = await this.prisma.models.ProcesoEtl.first({
      id: PROCESO_ID,
    });
    if (!proceso) return configuracionInicial;
    const conexion = proceso.conexion as Pick<
      ConfiguracionOagDto,
      'origenId' | 'destinoId' | 'periodo' | 'coberturaMinimaPct'
    > & { tramos?: Pick<ConfiguracionOagDto, 'origenId' | 'destinoId'>[] };
    const principal = conexion.tramos?.[0] ?? conexion;
    return {
      pausado: proceso.pausado,
      origenId: principal.origenId,
      destinoId: principal.destinoId,
      periodo: conexion.periodo,
      coberturaMinimaPct:
        conexion.coberturaMinimaPct ?? configuracionInicial.coberturaMinimaPct,
    };
  }

  async configurar({ pausado, ...alcance }: ConfiguracionOagDto) {
    await this.resolverAlcance(alcance);
    await this.prisma.models.ProcesoEtl.where({ id: PROCESO_ID }).update({
      pausado,
      conexion: { ...alcance, claveEntorno: OAG_CLAVE_ENTORNO },
    });
    return { pausado, ...alcance };
  }

  async resolverAlcance(
    config: Omit<ConfiguracionOagDto, 'pausado'>,
  ): Promise<AlcanceOag> {
    if (!periodosCerradosMapa().includes(config.periodo))
      throw new BadRequestException(
        'Seleccioná uno de los últimos 12 meses cerrados',
      );
    if (config.origenId === config.destinoId)
      throw new BadRequestException('Origen y destino deben ser distintos');
    const aeropuertos = this.prisma.models.Aeropuerto;
    const [origen, destino] = await Promise.all(
      [config.origenId, config.destinoId].map((id) =>
        aeropuertos.first({ id, archivadoEn: null }),
      ),
    );
    if (!origen || !destino)
      throw new BadRequestException('Aeropuerto no disponible');
    for (const campo of ['iata', 'icao'] as const) {
      const origenCodigo = origen[campo];
      const destinoCodigo = destino[campo];
      if (!origenCodigo || !destinoCodigo || origenCodigo === destinoCodigo)
        continue;
      const [origenes, destinos] = await Promise.all(
        [origenCodigo, destinoCodigo].map((codigo) =>
          aeropuertos
            .where({ [campo]: codigo, archivadoEn: null })
            .limit(2)
            .all(),
        ),
      );
      if (origenes.length === 1 && destinos.length === 1)
        return {
          ...config,
          origenCodigo,
          destinoCodigo,
          tipoCodigo: campo === 'iata' ? 'IATA' : 'ICAO',
        };
    }
    throw new BadRequestException(
      'El tramo no tiene códigos IATA o ICAO inequívocos',
    );
  }

  async ejecutar(
    solicitanteId?: string,
    alcanceAnterior?: AlcanceOag,
    checkpoint?: CheckpointOag,
    autorizarCambioFuente: string[] = [],
    servicio?: ServicioAdmitido,
  ) {
    const config = servicio ? undefined : await this.configuracion();
    if (config?.pausado) throw new ConflictException('OAG pausado');
    if (!process.env[OAG_CLAVE_ENTORNO]?.trim())
      throw new ConflictException(
        'OAG no cuenta con una credencial configurada',
      );
    const parametros = alcanceAnterior ?? config;
    if (!parametros)
      throw new BadRequestException('Falta el alcance del tramo');
    const { origenId, destinoId, periodo, coberturaMinimaPct } = parametros;
    const alcance = await this.resolverAlcance({
      origenId,
      destinoId,
      periodo,
      coberturaMinimaPct,
    });
    if (
      checkpoint &&
      alcanceAnterior &&
      (alcance.origenCodigo !== alcanceAnterior.origenCodigo ||
        alcance.destinoCodigo !== alcanceAnterior.destinoCodigo ||
        alcance.tipoCodigo !== alcanceAnterior.tipoCodigo)
    )
      checkpoint = undefined;
    const ejecucion = await this.prisma.db.transaction(async (tx) => {
      if (servicio) {
        await exigirServicioDisponible(tx, servicio);
      } else {
        const proceso = await tx.orm.public.ProcesoEtl.where({ id: PROCESO_ID })
          .select('pausado')
          .forUpdate()
          .first();
        if (!proceso || proceso.pausado)
          throw new ConflictException('OAG pausado');
      }
      await exigirIngestaDisponible(tx);
      return tx.orm.public.EjecucionEtl.create({
        fuente,
        estado: 'pending',
        solicitanteId: solicitanteId ?? null,
        procesoId: servicio?.id ?? PROCESO_ID,
        uriFuente: OAG_ENDPOINT,
        instantaneaConfiguracion: {
          conexion: {
            ...alcance,
            autorizarCambioFuente,
            ...(alcanceAnterior?.otrosTramos?.length && {
              otrosTramos: alcanceAnterior.otrosTramos,
            }),
            ...(checkpoint && { checkpoint }),
          },
          mapeoEsquema: [],
          configuracionProgramacion: {},
        },
      });
    });
    try {
      await this.encolar(ejecucion.id);
    } catch {
      this.logger.warn(
        `OAG ${ejecucion.id}: encolado pendiente de recuperación`,
      );
    }
    return { ejecucionId: ejecucion.id };
  }

  private encolar(ejecucionId: string) {
    return this.queue.add(
      'mes',
      { ejecucionId },
      {
        jobId: ejecucionId,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );
  }

  async ejecuciones() {
    const rows = await this.prisma.models.EjecucionEtl.where({ fuente })
      .orderBy((row) => row.iniciadoEn.desc())
      .limit(20)
      .all();
    return rows.map((row) => ({
      ...row,
      ...alcanceDe(row.instantaneaConfiguracion),
    }));
  }

  async reintentar(id: string, solicitanteId?: string) {
    const ejecucion = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente,
    });
    if (!ejecucion) throw new NotFoundException('Ejecución OAG inexistente');
    if (!['failed', 'completed'].includes(ejecucion.estado))
      throw new ConflictException('La ejecución sigue activa');
    const original = alcanceDe(ejecucion.instantaneaConfiguracion);
    if (!original) throw new BadRequestException('Falta el alcance del tramo');
    const alcance = {
      ...original,
      otrosTramos: original.otrosTramos?.map((tramo) => ({
        ...tramo,
        autorizarCambioFuente: [],
      })),
    };
    const proceso = ejecucion.procesoId
      ? await this.prisma.models.ProcesoEtl.first({ id: ejecucion.procesoId })
      : null;
    const servicio = proceso && {
      id: proceso.id,
      actualizadoEn: proceso.actualizadoEn,
    };
    const trabajo =
      ejecucion.estado === 'failed' ? await this.queue.getJob(id) : undefined;
    if ((trabajo?.data.reintentarDesde ?? 0) > Date.now())
      throw new ConflictException(
        'OAG todavía solicita esperar antes de reintentar',
      );
    if (!trabajo?.data.checkpoint || !ejecucion.iniciadoEn)
      return this.ejecutar(
        solicitanteId,
        alcance,
        undefined,
        [],
        servicio ?? undefined,
      );
    const publicacionPosterior = await this.hayPublicacionPosterior(
      alcance,
      ejecucion.iniciadoEn,
    );
    return this.ejecutar(
      solicitanteId,
      alcance,
      publicacionPosterior ? undefined : trabajo?.data.checkpoint,
      [],
      servicio ?? undefined,
    );
  }

  private async hayPublicacionPosterior(
    alcance: AlcanceOag,
    iniciadoEn: string,
  ) {
    const publicaciones = await leerPublicacionesDelTramo(
      this.prisma.db,
      alcance,
    );
    return publicaciones.some(
      (actual) =>
        actual.incluyeOag &&
        actual.actualizadoEn !== null &&
        actual.actualizadoEn > iniciadoEn,
    );
  }

  async importar(id: string) {
    const anterior = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente,
    });
    if (
      !anterior ||
      anterior.listaParaPublicar ||
      !['pending', 'running'].includes(anterior.estado)
    )
      return;
    const intento = anterior.intento + 1;
    const ejecucion = await this.prisma.models.EjecucionEtl.where({
      id,
      intento: anterior.intento,
      estado: anterior.estado,
      listaParaPublicar: false,
    }).update({ estado: 'running', intento, iniciadoEn: ahora() });
    if (!ejecucion) return;

    const progreso: ProgresoOag = { total: 0, descartadas: 0, paginas: 0 };
    let trabajo: Awaited<ReturnType<typeof this.queue.getJob>>;
    try {
      trabajo = await this.queue.getJob(id);
      if (
        ejecucion.procesoId === PROCESO_ID &&
        (await this.configuracion()).pausado
      )
        throw new FalloOag('OAG pausado');
      const clave = process.env[OAG_CLAVE_ENTORNO]?.trim();
      if (!clave)
        throw new FalloOag('OAG no cuenta con una credencial configurada');
      const alcance = alcanceDe(ejecucion.instantaneaConfiguracion);
      if (!alcance) throw new FalloOag('Falta el alcance del tramo');

      const tramos = [alcance, ...(alcance.otrosTramos ?? [])];
      const preparados: Awaited<ReturnType<OagService['leerTramo']>>[] = [];
      for (const tramo of tramos) {
        const reanudable = tramos.length === 1;
        preparados.push(
          await this.leerTramo(
            id,
            tramo,
            clave,
            progreso,
            reanudable ? trabajo : undefined,
            reanudable
              ? (trabajo?.data.checkpoint ?? alcance.checkpoint)
              : undefined,
          ),
        );
      }
      const procesadas = preparados.reduce(
        (suma, p) => suma + p.observaciones.length,
        0,
      );
      progreso.descartadas = progreso.total - procesadas;
      await this.prisma.db.transaction(async (tx) => {
        await bloquearCambiosMetricas(tx);
        const activa = await tx.orm.public.EjecucionEtl.where({
          id,
          intento,
          estado: 'running',
          listaParaPublicar: false,
        })
          .select('id')
          .forUpdate()
          .first();
        if (!activa) return;
        let insertadas = 0;
        for (const preparada of preparados) {
          await this.validarReemplazo(tx, preparada);
          for (
            let inicio = 0;
            inicio < preparada.observaciones.length;
            inicio += LOTE
          ) {
            const lote = await guardarObservaciones(
              tx,
              preparada.observaciones.slice(inicio, inicio + LOTE),
              id,
            );
            insertadas += lote.insertadas;
          }
        }
        await tx.orm.public.EjecucionEtl.where({ id, intento }).update({
          listaParaPublicar: true,
          filasTotales: progreso.total,
          filasProcesadas: procesadas,
          filasDescartadas: progreso.descartadas,
          filasInsertadas: insertadas,
        });
      });
    } catch (error) {
      const mensaje =
        error instanceof FalloOag
          ? error.message
          : 'No se pudo publicar la ejecución OAG';
      await this.fallar(
        id,
        intento,
        mensaje,
        progreso.total,
        progreso.descartadas,
        error instanceof CredencialOagRechazada
          ? (ejecucion.procesoId ?? undefined)
          : undefined,
      );
      if (error instanceof CuotaOagAgotada && trabajo)
        await trabajo.updateData({
          ...trabajo.data,
          reintentarDesde: error.reintentarDesde,
        });
      throw new Error(mensaje);
    }
  }

  private async leerTramo(
    id: string,
    alcance: TramoOag,
    clave: string,
    progreso: ProgresoOag,
    trabajo?: Awaited<ReturnType<Queue<TrabajoOag>['getJob']>>,
    checkpoint?: CheckpointOag,
  ) {
    const cursores = checkpoint?.cursores ?? [];
    let total = checkpoint?.total ?? 0;
    let descartadas = checkpoint?.descartadas ?? 0;
    progreso.total += total;
    progreso.descartadas += descartadas;
    progreso.paginas += cursores.length;
    const candidatos = new Map(checkpoint?.candidatos);
    const aerolineas = new Map<string, Promise<string | null>>();
    await ingerirOperaciones(
      this.adaptador,
      { consulta: alcance, clave, cursores },
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
            resolucion = this.resolverAerolinea(carrier);
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
          if (cursor && trabajo) {
            cursores.push(cursor);
            await trabajo.updateData({
              ejecucionId: id,
              checkpoint: {
                cursores,
                total,
                descartadas,
                candidatos: [...candidatos],
              },
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
      throw new FalloOag('Cobertura OAG insuficiente para publicar');
    }
    return { alcance, ...preparada };
  }

  private async validarReemplazo(
    tx: Transaction,
    {
      alcance,
      observaciones,
      totalesPorOperadora,
    }: Awaited<ReturnType<OagService['leerTramo']>>,
  ) {
    const autoridades = await leerPublicacionesDelTramo(tx, alcance);
    const perdioCobertura = autoridades.some(
      (actual) =>
        actual.incluyeOag &&
        (totalesPorOperadora[actual.aerolineaId] ?? 0) < actual.vuelosTotales,
    );
    if (
      perdioCobertura ||
      (await this.faltaObservacionAnterior(
        tx,
        alcance,
        observaciones.map((vuelo) => vuelo.idRegistroFuente),
        autoridades,
      ))
    ) {
      throw new FalloOag(
        'Cobertura OAG insuficiente para una operadora ya publicada',
      );
    }
    const autorizadas = new Set(alcance.autorizarCambioFuente);
    if (
      autoridades.some(
        (actual) =>
          totalesPorOperadora[actual.aerolineaId] > 0 &&
          !admiteFuente(actual, fuente, autorizadas.has(actual.aerolineaId)),
      )
    ) {
      throw new FalloOag(
        'El cambio de fuente requiere autorización por operadora',
      );
    }
  }

  private async resolverAerolinea({
    iata,
    icao,
  }: Codigos): Promise<string | null> {
    if (iata && !/^[A-Z0-9]{2}$/.test(iata)) return null;
    if (icao && !/^[A-Z0-9]{3}$/.test(icao)) return null;
    if (!iata && !icao) return null;
    const aerolineas = this.prisma.models.Aerolinea;
    const ids: string[] = [];
    for (const [campo, codigo] of [
      ['iata', iata],
      ['icao', icao],
    ] as const) {
      if (!codigo) continue;
      const rows = await aerolineas
        .where({ [campo]: codigo, archivadoEn: null })
        .limit(2)
        .all();
      if (rows.length > 1) return null;
      if (rows[0]) ids.push(rows[0].id);
      else if (iata && icao) return null;
    }
    return ids.length && ids.every((id) => id === ids[0]) ? ids[0] : null;
  }

  private async faltaObservacionAnterior(
    tx: Transaction,
    { origenId, destinoId, periodo }: AlcanceOag,
    identidades: string[],
    autoridades: Awaited<ReturnType<typeof leerPublicacionesDelTramo>>,
  ) {
    const desde = periodo + '-01';
    const hasta = ultimoDiaDelMes(desde);
    for (const anterior of autoridades) {
      if (anterior.fuente !== fuente || !anterior.ejecucionId) continue;
      const vigentes = tx.orm.public.Vuelo.where({
        origenId,
        destinoId,
        fuente,
        archivadoEn: null,
        aerolineaId: anterior.aerolineaId,
        ejecucionEtlId: anterior.ejecucionId,
      })
        .where((v) => v.fechaVuelo.gte(desde))
        .where((v) => v.fechaVuelo.lte(hasta));
      const faltante = await vigentes
        .where((v) => not(v.idRegistroFuente.in(identidades)))
        .select('id')
        .first();
      if (faltante) return true;
    }
    return false;
  }

  private publicar(id: string, intento: number) {
    return this.prisma.db.transaction(async (tx) => {
      await bloquearCambiosMetricas(tx);
      const registro = await tx.orm.public.EjecucionEtl.where({
        id,
        intento,
        estado: 'running',
        listaParaPublicar: true,
      })
        .forUpdate()
        .first();
      if (!registro) return;
      const alcance = alcanceDe(registro.instantaneaConfiguracion);
      if (!alcance?.periodo)
        throw new Error('Falta el alcance de publicación OAG');
      // FIXME(T12): exigir aprobación y verificar permisos antes de publicar datos reales.
      for (const tramo of [alcance, ...(alcance.otrosTramos ?? [])]) {
        const autorizadas = new Set(tramo.autorizarCambioFuente);
        await publicarPoblacionesCandidatas(
          tx,
          tramo.periodo,
          id,
          fuente,
          ({ aerolineaId }) => autorizadas.has(aerolineaId),
          tramo,
        );
      }
      await tx.orm.public.EjecucionEtl.where({ id }).update({
        estado: 'completed',
        mensajeError: null,
        listaParaPublicar: false,
        finalizadoEn: ahora(),
      });
      await tx.orm.public.EventoEjecucionEtl.create({
        ejecucionId: id,
        intento,
        nivel: 'success',
        mensaje: `OAG publicado: ${registro.filasProcesadas} operaciones y ${registro.filasDescartadas} descartes`,
      });
    });
  }

  private async fallar(
    id: string,
    intento: number,
    mensaje: string,
    filasTotales: number,
    filasDescartadas: number,
    pausarProceso?: string,
  ) {
    await this.prisma.db.transaction(async (tx) => {
      if (pausarProceso)
        await tx.orm.public.ProcesoEtl.where({ id: pausarProceso }).update({
          pausado: true,
        });
      const ejecucion = await tx.orm.public.EjecucionEtl.where({
        id,
        intento,
        listaParaPublicar: false,
      })
        .where((row) => row.estado.in(['pending', 'running']))
        .update({
          estado: 'failed',
          listaParaPublicar: false,
          finalizadoEn: intento ? ahora() : null,
          mensajeError: mensaje,
          filasTotales,
          filasDescartadas,
        });
      if (ejecucion)
        await tx.orm.public.EventoEjecucionEtl.create({
          ejecucionId: id,
          intento,
          nivel: 'error',
          mensaje,
        });
    });
  }
}

function alcanceDe(snapshot: unknown) {
  return (snapshot as { conexion?: AlcanceOag } | null)?.conexion;
}
