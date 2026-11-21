import {
  expresionCronOag,
  PROCESO_OAG_ID as PROCESO_ID,
} from '../../ingestion/infrastructure/cron-operaciones.js';
import { ConfiguracionOag } from './configuracion-oag.js';
import {
  exigirIngestaDisponible,
  exigirServicioDisponible,
  type ServicioAdmitido,
} from '../../ingestion/infrastructure/admision-operaciones.js';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { UnrecoverableError, type Job, type Queue } from 'bullmq';
import { periodosCerradosMapa } from '../../metrics/periodos-mapa.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CredencialOagRechazada,
  FalloTransitorioOag,
  OAG_CLAVE_ENTORNO,
  OAG_ENDPOINT,
} from './flight-info.js';

import { CargarOag } from '../../ingestion/application/oag/cargar-oag.js';
import { PublicacionOagStore } from './publicacion-oag.store.js';
import {
  alcanceDe,
  FalloOag,
  type AlcanceOag,
  type CheckpointOag,
  type ProgresoOag,
} from '../../ingestion/application/oag/alcance-oag.js';
import { INTENTOS_OAG, OAG_QUEUE, type TrabajoOag } from './cola-oag.js';

const fuente = 'OAG';
const ahora = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
@Injectable()
export class OagService implements OnModuleInit {
  private readonly logger = new Logger(OagService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OAG_QUEUE) private readonly queue: Queue<TrabajoOag>,
    private readonly config: ConfiguracionOag,
    private readonly carga: CargarOag,
    private readonly publicacion: PublicacionOagStore,
  ) {}

  async onModuleInit() {
    await this.queue.setGlobalConcurrency(1);
    await this.config.inicializar();
    await this.queue.upsertJobScheduler(
      'recuperar-oag',
      { every: 5000 },
      { name: 'recuperar', opts: { removeOnComplete: 10, removeOnFail: 10 } },
    );
    await this.recuperar();
  }

  async recuperar() {
    await this.config.sincronizarCron();
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
            await this.publicacion.publicar(pendiente.id, pendiente.intento);
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

  async ejecutarProgramada(cron?: string) {
    const proceso = await this.prisma.models.ProcesoEtl.first({
      id: PROCESO_ID,
    });
    if (
      !cron ||
      !proceso ||
      proceso.pausado ||
      cron !== expresionCronOag(proceso.configuracionProgramacion)
    )
      return;
    const [principal, ...otrosTramos] = await this.config.resolverTramos({
      ...this.config.leerConfiguracion(proceso),
      periodo: periodosCerradosMapa()[0],
    });
    return this.ejecutar(
      undefined,
      { ...principal, otrosTramos },
      undefined,
      [],
      {
        id: proceso.id,
        actualizadoEn: proceso.actualizadoEn,
      },
    );
  }

  async ejecutarTramo(
    {
      origenId,
      destinoId,
      periodo,
    }: { origenId: string; destinoId: string; periodo: string },
    solicitanteId: string,
  ) {
    const config = await this.config.configuracion();
    if (config.pausado)
      throw new ConflictException(
        'El servicio de carga por tramo está pausado',
      );
    const alcance = await this.config.resolverAlcance({
      origenId,
      destinoId,
      periodo,
      coberturaMinimaPct: config.coberturaMinimaPct,
    });
    return this.ejecutar(solicitanteId, alcance);
  }

  async ejecutar(
    solicitanteId?: string,
    alcanceAnterior?: AlcanceOag,
    reanudacion?: { pagina: CheckpointOag; iniciadoEn: string },
    autorizarCambioFuente: string[] = [],
    servicio?: ServicioAdmitido,
  ) {
    const config = servicio ? undefined : await this.config.configuracion();
    if (config?.pausado) throw new ConflictException('OAG pausado');
    if (!process.env[OAG_CLAVE_ENTORNO]?.trim())
      throw new ConflictException(
        'OAG no cuenta con una credencial configurada',
      );
    const parametros = alcanceAnterior ?? config;
    if (!parametros)
      throw new BadRequestException('Falta el alcance del tramo');
    const [alcance, ...otrosTramos] = alcanceAnterior
      ? await Promise.all(
          [alcanceAnterior, ...(alcanceAnterior.otrosTramos ?? [])].map(
            async ({
              origenId,
              destinoId,
              periodo,
              coberturaMinimaPct,
              autorizarCambioFuente,
            }) => ({
              ...(await this.config.resolverAlcance({
                origenId,
                destinoId,
                periodo,
                coberturaMinimaPct,
              })),
              autorizarCambioFuente,
            }),
          ),
        )
      : await this.config.resolverTramos(parametros);
    if (
      reanudacion &&
      alcanceAnterior &&
      (alcance.origenCodigo !== alcanceAnterior.origenCodigo ||
        alcance.destinoCodigo !== alcanceAnterior.destinoCodigo ||
        alcance.tipoCodigo !== alcanceAnterior.tipoCodigo)
    )
      reanudacion = undefined;
    const ejecucion = await this.prisma.db.transaction(async (tx) => {
      await exigirIngestaDisponible(tx);
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
      const checkpoint =
        reanudacion &&
        !(await this.publicacion.hayPublicacionPosterior(
          tx,
          alcance,
          reanudacion.iniciadoEn,
        ))
          ? reanudacion.pagina
          : undefined;
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
            ...(otrosTramos.length && {
              otrosTramos,
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
        attempts: INTENTOS_OAG,
        backoff: { type: 'oag' },
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
    const checkpoint = trabajo?.data.avance?.pagina ?? trabajo?.data.checkpoint;
    const reanudacion =
      checkpoint && !alcance.otrosTramos?.length && ejecucion.iniciadoEn
        ? { pagina: checkpoint, iniciadoEn: ejecucion.iniciadoEn }
        : undefined;
    return this.ejecutar(
      solicitanteId,
      alcance,
      reanudacion,
      [],
      servicio ?? undefined,
    );
  }

  async importar(trabajo: Job<TrabajoOag>) {
    const id = trabajo.data.ejecucionId;
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
    }).update({
      estado: 'running',
      intento,
      iniciadoEn: anterior.iniciadoEn ?? ahora(),
      mensajeError: null,
    });
    if (!ejecucion) return;

    const progreso: ProgresoOag = { total: 0, descartadas: 0, paginas: 0 };
    try {
      if (
        ejecucion.procesoId === PROCESO_ID &&
        (await this.config.configuracion()).pausado
      )
        throw new FalloOag('OAG pausado');
      const alcance = alcanceDe(ejecucion.instantaneaConfiguracion);
      if (!alcance) throw new FalloOag('Falta el alcance del tramo');

      const { avance, checkpoint } = trabajo.data;
      await this.carga.ejecutar(id, intento, alcance, progreso, {
        anterior:
          avance ??
          (checkpoint && {
            preparados: [],
            progreso: { ...progreso },
            pagina: checkpoint,
          }),
        guardar: (avance) => trabajo.updateData({ ejecucionId: id, avance }),
      });
    } catch (error) {
      if (error instanceof FalloTransitorioOag) {
        await trabajo.updateData({
          ...trabajo.data,
          reintentarDesde: error.reintentarDesde,
        });
        if (trabajo.attemptsMade + 1 < (trabajo.opts.attempts ?? 1))
          throw error;
      }
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
      if (
        error instanceof CredencialOagRechazada &&
        ejecucion.procesoId === PROCESO_ID
      )
        await this.config.sincronizarCron();
      throw new UnrecoverableError(mensaje);
    }
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
