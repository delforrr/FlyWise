import { or } from '@prisma/orm-postgres/orm-client';
import { bloquearRecurso } from '../prisma/bloqueo-transaccional.js';
import {
  exigirIngestaDisponible,
  exigirServicioDisponible,
  type ServicioAdmitido,
} from '../ingestion/infrastructure/admision-operaciones.js';
import { fechaInformadaBts } from '../adapters/bts/operacion-bts.js';
import type { AdaptadorOperaciones } from '../ingestion/application/adaptador-operaciones.js';
import {
  type CausaDescarteBts,
  type OperacionBts,
} from '../adapters/bts/operacion-bts.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { defaultRepeatStrategy, UnrecoverableError, type Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Transaction } from '../prisma/db.js';
import type {
  ConfiguracionBtsDto,
  ConsultaBtsDto,
  PoblacionBtsDto,
  CorrespondenciaBtsDto,
} from './bts.dto.js';
import type { Readable } from 'node:stream';
import {
  ADAPTADOR_BTS,
  type LecturaBts,
} from '../adapters/bts/adaptador-bts.js';
import { ingerirOperaciones } from '../ingestion/application/ingesta-operaciones.js';
import { createHash } from 'node:crypto';
import { abrirCsvBts, descargarBts } from '../adapters/bts/bts-source.js';
import { bloquearCambiosMetricas } from '../metrics/publicacion.store.js';
import { publicarPoblacionesCandidatas } from '../metrics/poblaciones-candidatas.store.js';
import { VuelosService } from '../vuelos/vuelos.service.js';
import type { ObservacionVuelo } from '../entities/vuelos/domain/operacion.js';

const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
@Injectable()
export class BtsService implements OnModuleInit {
  private readonly logger = new Logger(BtsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('bts-queue') private readonly queue: Queue,
    private readonly vuelos: VuelosService,
    @Inject(ADAPTADOR_BTS)
    private readonly adaptador: AdaptadorOperaciones<LecturaBts, OperacionBts>,
  ) {}
  async onModuleInit() {
    await this.schedule(await this.configuracion());
    await this.queue.setGlobalConcurrency(1);
    await this.queue.upsertJobScheduler(
      'recuperar-bts',
      { every: 5000 },
      { name: 'recuperar', opts: { removeOnComplete: 10, removeOnFail: 10 } },
    );
    await this.recuperar();
  }

  async recuperar() {
    let cursor = '';
    for (;;) {
      const jobs = await this.prisma.models.EjecucionEtl.where({
        fuente: 'BTS',
      })
        .where((job) => job.estado.in(['pending', 'running']))
        .where((job) => job.id.gt(cursor))
        .orderBy((job) => job.id.asc())
        .limit(100)
        .all();
      for (const job of jobs) {
        const periodo = periodoDe(job);
        if (!periodo) {
          await this.prisma.models.EjecucionEtl.where({
            id: job.id,
            intento: job.intento,
            estado: job.estado,
          }).update({
            estado: 'failed',
            listaParaPublicar: false,
            finalizadoEn: job.iniciadoEn ? now() : null,
            mensajeError: 'La ejecución BTS no conserva su mes',
          });
          continue;
        }
        if (job.listaParaPublicar) {
          try {
            await this.publicar(job.id, job.intento, periodo);
          } catch (error) {
            await this.prisma.models.EjecucionEtl.where({
              id: job.id,
              intento: job.intento,
              listaParaPublicar: true,
            }).update({
              mensajeError: 'BTS: publicación pendiente de reintento',
            });
            this.logger.error(`BTS ${job.id}: falló la promoción`, error);
          }
          continue;
        }
        const queued = await this.queue.getJob(job.id);
        if (!queued) await this.encolar(job.id, periodo);
        else if (['failed', 'completed'].includes(await queued.getState())) {
          await this.prisma.models.EjecucionEtl.where({
            id: job.id,
            intento: job.intento,
            listaParaPublicar: false,
          })
            .where((row) => row.estado.in(['pending', 'running']))
            .update({
              estado: 'failed',
              finalizadoEn: job.iniciadoEn ? now() : null,
              mensajeError: 'BullMQ agotó los intentos de esta ejecución BTS',
            });
        }
      }
      if (jobs.length < 100) break;
      cursor = jobs[jobs.length - 1].id;
    }
  }
  private bloquear(tx: Transaction) {
    return bloquearRecurso(tx, 'bts');
  }
  async configuracion(): Promise<ConfiguracionBtsDto> {
    const config = await this.prisma.models.ConfiguracionBts.select(
      'periodo',
      'pausado',
      'expresionCron',
    ).first({ id: true });
    return config ?? { periodo: '', pausado: true, expresionCron: '' };
  }
  async configurar(dto: ConfiguracionBtsDto) {
    if (dto.periodo >= new Date().toISOString().slice(0, 7))
      throw new BadRequestException(
        'Selecciona un mes finalizado; no se realiza backfill automático',
      );
    if (dto.expresionCron) {
      // Los cinco campos restringen la ejecución a un día mensual y UTC.
      if (
        !/^[0-5]?\d (?:[01]?\d|2[0-3]) (?:[1-9]|[12]\d|3[01]) \* \*$/.test(
          dto.expresionCron,
        )
      )
        throw new BadRequestException('La programación debe ser mensual');
      try {
        defaultRepeatStrategy(Date.now(), {
          pattern: dto.expresionCron,
          tz: 'UTC',
        });
      } catch {
        throw new BadRequestException('Expresión cron inválida');
      }
    }
    const { periodo, pausado, expresionCron } = dto;
    const valores = { periodo, pausado, expresionCron };
    await this.prisma.models.ConfiguracionBts.upsert({
      create: { id: true, ...valores },
      update: valores,
    });
    await this.schedule(dto);
    return this.configuracion();
  }
  private async schedule(dto: ConfiguracionBtsDto) {
    if (dto.pausado || !dto.expresionCron)
      await this.queue.removeJobScheduler('bts-mensual');
    else
      await this.queue.upsertJobScheduler(
        'bts-mensual',
        { pattern: dto.expresionCron, tz: 'UTC' },
        { name: 'programada', data: {} },
      );
  }
  async ejecutar(
    periodo?: string,
    solicitanteId?: string,
    manual = false,
    autorizarCambioFuente: PoblacionBtsDto[] = [],
    servicio?: ServicioAdmitido,
  ) {
    const config = await this.configuracion();
    if (config.pausado && !manual) throw new ConflictException('BTS pausado');
    periodo ??= config.periodo;
    if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(periodo))
      throw new BadRequestException('Selecciona un mes');
    if (periodo >= new Date().toISOString().slice(0, 7))
      throw new BadRequestException('Seleccioná un mes finalizado');
    const uriFuente = urlBts(periodo);
    const record = await this.prisma.db.transaction(async (tx) => {
      if (servicio) await exigirServicioDisponible(tx, servicio);
      await exigirIngestaDisponible(tx);
      return tx.orm.public.EjecucionEtl.create({
        fuente: 'BTS',
        estado: 'pending',
        procesoId: servicio?.id,
        solicitanteId: solicitanteId ?? null,
        uriFuente,
        instantaneaConfiguracion: {
          conexion: {
            periodo,
            urlEndpoint: uriFuente,
            autorizarCambioFuente: autorizarCambioFuente.map(
              ({ origenId, destinoId, aerolineaId }) => ({
                origenId,
                destinoId,
                aerolineaId,
              }),
            ),
          },
          mapeoEsquema: [],
          configuracionProgramacion: { ...config },
        },
      });
    });
    try {
      await this.encolar(record.id, periodo);
    } catch {
      this.logger.warn(`BTS ${record.id}: encolado pendiente de recuperación`);
    }
    return { ejecucionId: record.id };
  }
  private encolar(ejecucionId: string, periodo: string) {
    return this.queue.add(
      'mes',
      { ejecucionId, periodo },
      {
        jobId: ejecucionId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );
  }
  async ejecuciones() {
    const rows = await this.prisma.models.EjecucionEtl.where({ fuente: 'BTS' })
      .orderBy((row) => row.iniciadoEn.desc())
      .limit(20)
      .all();
    return rows.map((row) => ({ ...row, periodo: periodoDe(row) }));
  }
  async descartes(id: string, intento?: number) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente: 'BTS',
    });
    if (!job) throw new NotFoundException('Ejecución BTS inexistente');
    return this.prisma.models.MuestraDescartadaEtl.where({
      ejecucionId: id,
      intento: intento ?? job.intento,
    })
      .orderBy((row) => row.numeroFila.asc())
      .limit(100)
      .all();
  }
  async reintentar(id: string, solicitanteId?: string) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente: 'BTS',
    });
    if (!job) throw new NotFoundException('Ejecución BTS inexistente');
    if (
      job.estado !== 'failed' &&
      !(job.estado === 'completed' && job.filasDescartadas > 0)
    )
      throw new ConflictException(
        'Sólo se reintentan ejecuciones fallidas o parciales',
      );
    const periodo = periodoDe(job);
    if (!periodo)
      throw new BadRequestException('La ejecución no conserva su mes');
    const proceso = job.procesoId
      ? await this.prisma.models.ProcesoEtl.first({ id: job.procesoId })
      : null;
    return this.ejecutar(
      periodo,
      solicitanteId,
      true,
      [],
      proceso
        ? { id: proceso.id, actualizadoEn: proceso.actualizadoEn }
        : undefined,
    );
  }
  async cobertura() {
    const filas = await this.prisma.models.CoberturaBts.include(
      'ejecucion',
      (ejecucion) => ejecucion.select('filasDescartadas'),
    )
      .orderBy((fila) => fila.periodo.desc())
      .limit(100)
      .all();
    return filas.flatMap(({ ejecucion, ...fila }) =>
      ejecucion
        ? [
            {
              ...fila,
              publicadoEn: fila.publicadoEn.replace(
                /(\.\d*?[1-9])0+$|\.0+$/,
                '$1',
              ),
              descartadas: ejecucion.filasDescartadas,
            },
          ]
        : [],
    );
  }
  async pendientes(dto: ConsultaBtsDto) {
    const pagina =
      dto.tipo === 'operadores'
        ? await this.pendientesOperadores(dto)
        : await this.pendientesAeropuertos(dto);
    return { ...pagina, pagina: dto.pagina, limite: dto.limite };
  }

  private async pendientesOperadores(dto: ConsultaBtsDto) {
    const pendientes = this.prisma.models.IdentidadOperadorBts.where({
      aerolineaId: null,
    });
    const [datos, { total }] = await Promise.all([
      pendientes
        .select('identificador', 'codigo')
        .orderBy((i) => i.identificador.asc())
        .offset((dto.pagina - 1) * dto.limite)
        .limit(dto.limite)
        .all(),
      pendientes.aggregate((i) => ({ total: i.count() })),
    ]);
    return { datos, total: datos.length ? total : 0 };
  }

  private async pendientesAeropuertos(dto: ConsultaBtsDto) {
    const pendientes = this.prisma.models.IdentidadAeropuertoFuente.where({
      fuente: 'BTS',
      aeropuertoId: null,
    });
    const [filas, { total }] = await Promise.all([
      pendientes
        .select('identificador', 'observacion')
        .orderBy((i) => i.identificador.asc())
        .offset((dto.pagina - 1) * dto.limite)
        .limit(dto.limite)
        .all(),
      pendientes.aggregate((i) => ({ total: i.count() })),
    ]);
    const datos = filas.map(({ identificador, observacion }) => {
      const codigo =
        observacion &&
        typeof observacion === 'object' &&
        'codigo' in observacion
          ? observacion.codigo
          : null;
      return {
        identificador,
        codigo: typeof codigo === 'string' ? codigo : '',
      };
    });
    return { datos, total: datos.length ? total : 0 };
  }

  async resolver(dto: CorrespondenciaBtsDto) {
    return this.prisma.db.transaction(async (db) => {
      await this.bloquear(db);
      const changed =
        dto.tipo === 'operadores'
          ? await this.resolverOperador(db, dto.identificador, dto.entidadId)
          : await this.resolverAeropuerto(db, dto.identificador, dto.entidadId);
      if (!changed)
        throw new ConflictException(
          'Correspondencia inexistente, ya resuelta o aeropuerto vinculado a otra identidad BTS',
        );
      return { resuelto: true };
    });
  }
  private async resolverOperador(
    tx: Transaction,
    identificador: string,
    entidadId: string,
  ) {
    const aerolinea = await tx.orm.public.Aerolinea.select('id').first({
      id: entidadId,
      archivadoEn: null,
    });
    if (!aerolinea)
      throw new BadRequestException('Entidad inexistente o archivada');

    return tx.orm.public.IdentidadOperadorBts.where({ identificador })
      .where((i) => or(i.aerolineaId.isNull(), i.aerolineaId.eq(entidadId)))
      .select('identificador')
      .update({ aerolineaId: entidadId });
  }

  private async resolverAeropuerto(
    tx: Transaction,
    identificador: string,
    entidadId: string,
  ) {
    const aeropuerto = await tx.orm.public.Aeropuerto.select('id')
      .include('identidadesFuente', (identidades) =>
        identidades
          .where({ fuente: 'BTS' })
          .where((i) => i.identificador.neq(identificador))
          .select('identificador')
          .limit(1),
      )
      .first({ id: entidadId, archivadoEn: null });
    if (!aeropuerto)
      throw new BadRequestException('Entidad inexistente o archivada');
    if (aeropuerto.identidadesFuente.length) return null;

    return tx.orm.public.IdentidadAeropuertoFuente.where({
      fuente: 'BTS',
      identificador,
    })
      .where((i) => or(i.aeropuertoId.isNull(), i.aeropuertoId.eq(entidadId)))
      .select('identificador')
      .update({ aeropuertoId: entidadId });
  }

  async importar(
    ejecucionId: string,
    periodo: string,
    path?: string,
    quedanIntentos = false,
  ) {
    let download: Awaited<ReturnType<typeof descargarBts>> | undefined;
    let csvSource: Awaited<ReturnType<typeof abrirCsvBts>> | undefined;
    try {
      return await this.procesar(
        ejecucionId,
        periodo,
        async () => {
          if (!path) {
            download = await descargarBts(urlBts(periodo));
            path = download.path;
          }
          csvSource = await abrirCsvBts(path);
          return csvSource.stream;
        },
        quedanIntentos,
      );
    } finally {
      csvSource?.close();
      await download?.cleanup();
    }
  }

  async procesar(
    ejecucionId: string,
    periodo: string,
    source: Readable | (() => Promise<Readable>),
    quedanIntentos = false,
  ) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id: ejecucionId,
      fuente: 'BTS',
    });
    if (!job) throw new NotFoundException('Ejecución BTS inexistente');
    if (job.estado === 'completed' || job.listaParaPublicar)
      return {
        procesadas: job.filasProcesadas,
        insertadas: job.filasInsertadas,
        descartadas: job.filasDescartadas,
      };
    const intento = job.intento + 1;
    const db = this.prisma.db;
    await db.transaction(async (tx) => {
      if (job.estado === 'failed') await exigirIngestaDisponible(tx);
      const iniciada = await tx.orm.public.EjecucionEtl.where({
        id: ejecucionId,
        estado: job.estado,
        intento: job.intento,
        listaParaPublicar: false,
      }).update({
        estado: 'running',
        intento,
        iniciadoEn: now(),
        finalizadoEn: null,
        mensajeError: null,
        filasTotales: 0,
        filasProcesadas: 0,
        filasInsertadas: 0,
        filasDescartadas: 0,
      });
      if (!iniciada)
        throw new ConflictException('La ejecución BTS cambió de estado');
    });
    await this.prisma.models.PreparacionBts.where({
      ejecucionId,
    }).deleteAndCount();
    await this.prisma.models.EventoEjecucionEtl.create({
      ejecucionId,
      intento,
      nivel: 'info',
      mensaje: `Inicio de BTS ${periodo}`,
    });
    let total = 0,
      procesadas = 0,
      descartadas = 0,
      sinCorrespondencia = 0,
      samples = 0;
    let batch: OperacionBts[] = [];
    const dias = new Set<string>();
    const hash = createHash('sha256');
    const descartesPorCausa = { identidad: 0, formato: 0, elegibilidad: 0 };
    const resumenDescartes = () =>
      `Descartes BTS: identidad ${descartesPorCausa.identidad}, formato ${descartesPorCausa.formato}, elegibilidad ${descartesPorCausa.elegibilidad}`;
    const discard = async (
      numeroFila: number,
      causa: CausaDescarteBts,
      motivo: string,
      row: unknown,
    ) => {
      descartadas++;
      descartesPorCausa[causa]++;
      if (samples++ < 100)
        await this.prisma.models.MuestraDescartadaEtl.create({
          ejecucionId,
          intento,
          numeroFila,
          motivo,
          muestraOriginal: JSON.stringify(row).slice(0, 4096),
        });
    };
    const flush = async () => {
      if (!batch.length) return;
      const input = JSON.stringify(batch);
      await db.execute(
        db.raw
          .sql`INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,observacion)
        SELECT 'BTS',identificador,jsonb_build_object('codigo',codigo) FROM (
          SELECT DISTINCT ON(identificador) identificador,codigo FROM jsonb_to_recordset(${input}::jsonb) x("origenBts" text,"destinoBts" text,"codigoOrigen" text,"codigoDestino" text)
          CROSS JOIN LATERAL (VALUES(x."origenBts",x."codigoOrigen"),(x."destinoBts",x."codigoDestino")) y(identificador,codigo)
        ) z ON CONFLICT(fuente,identificador) DO UPDATE SET observacion=EXCLUDED.observacion`
          .affectedCount()
          .build(),
      );
      await db.execute(
        db.raw.sql`INSERT INTO identidades_operador_bts(identificador,codigo)
        SELECT DISTINCT ON("operadorBts") "operadorBts","codigoOperador" FROM jsonb_to_recordset(${input}::jsonb) x("operadorBts" text,"codigoOperador" text)
        ON CONFLICT(identificador) DO UPDATE SET codigo=EXCLUDED.codigo`
          .affectedCount()
          .build(),
      );
      await db.transaction(async (tx) => {
        await this.bloquear(tx);
        await tx.execute(
          tx.raw.sql`WITH candidatos AS (
            SELECT i.identificador, min(a.id) AS entidad
            FROM identidades_aeropuerto_fuente i
            JOIN aeropuertos a ON a.iata=i.observacion->>'codigo' AND a.archivado_en IS NULL
            WHERE i.fuente='BTS' AND i.aeropuerto_id IS NULL
              AND i.identificador IN (
                SELECT y.identificador FROM jsonb_to_recordset(${input}::jsonb) x("origenBts" text,"destinoBts" text)
                CROSS JOIN LATERAL (VALUES(x."origenBts"),(x."destinoBts")) y(identificador)
              )
              AND NOT EXISTS (
                SELECT 1 FROM identidades_aeropuerto_fuente j
                WHERE j.fuente='BTS' AND j.identificador<>i.identificador
                  AND (j.aeropuerto_id=a.id OR j.observacion->>'codigo'=a.iata)
              )
            GROUP BY i.identificador HAVING count(*)=1
          )
          UPDATE identidades_aeropuerto_fuente i SET aeropuerto_id=c.entidad
          FROM candidatos c WHERE i.fuente='BTS' AND i.identificador=c.identificador
            AND i.aeropuerto_id IS NULL`
            .affectedCount()
            .build(),
        );
        await tx.execute(
          tx.raw.sql`WITH candidatos AS (
            SELECT i.identificador, min(a.id) AS entidad
            FROM identidades_operador_bts i
            JOIN aerolineas a ON a.iata=i.codigo AND a.archivado_en IS NULL AND a.activa IS DISTINCT FROM false
            WHERE i.aerolinea_id IS NULL
              AND i.identificador IN (
                SELECT x."operadorBts" FROM jsonb_to_recordset(${input}::jsonb) x("operadorBts" text)
              )
              AND NOT EXISTS (
                SELECT 1 FROM identidades_operador_bts j WHERE j.identificador<>i.identificador
                  AND (j.aerolinea_id=a.id OR j.codigo=i.codigo)
              )
            GROUP BY i.identificador HAVING count(*)=1
          )
          UPDATE identidades_operador_bts i SET aerolinea_id=c.entidad
          FROM candidatos c WHERE i.identificador=c.identificador AND i.aerolinea_id IS NULL`
            .affectedCount()
            .build(),
        );
      });
      const { aeropuertos, operadores } =
        await this.leerCorrespondenciasLote(batch);
      const accepted: (OperacionBts & {
        origenId: string;
        destinoId: string;
        aerolineaId: string;
      })[] = [];
      for (const row of batch) {
        const origenId = aeropuertos.get(row.origenBts);
        const destinoId = aeropuertos.get(row.destinoBts);
        const aerolineaId = operadores.get(row.operadorBts);
        if (!origenId || !destinoId || !aerolineaId) {
          sinCorrespondencia++;
          await discard(
            row.numeroFila,
            'identidad',
            'Faltan correspondencias BTS explícitas',
            row,
          );
          continue;
        }
        accepted.push({ ...row, origenId, destinoId, aerolineaId });
      }
      if (accepted.length) {
        const staged = await this.prisma.models.PreparacionBts.select(
          'numeroFila',
        ).createAll(
          accepted.map((fila) => ({
            ejecucionId,
            identidad: fila.identidad,
            numeroFila: fila.numeroFila,
            observacion: fila,
          })),
          { onConflict: 'skip' },
        );
        const stagedRows = new Set(staged.map(({ numeroFila }) => numeroFila));
        for (const row of accepted)
          if (!stagedRows.has(row.numeroFila))
            await discard(
              row.numeroFila,
              'identidad',
              'Identidad de vuelo BTS repetida',
              row,
            );
        procesadas += staged.length;
      }
      batch = [];
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        filasTotales: total,
        filasProcesadas: procesadas,
        filasDescartadas: descartadas,
      });
    };
    try {
      await ingerirOperaciones(
        this.adaptador,
        {
          periodo,
          source,
          registrarBytes: (chunk: Buffer | string) => {
            hash.update(chunk);
          },
        },
        {
          async procesarFila(fila) {
            total++;
            if (fila.tipo === 'descarte')
              await discard(total, fila.causa, fila.motivo, fila.original);
            else if (fila.tipo === 'operacion') {
              dias.add(fila.operacion.fechaVuelo);
              batch.push(fila.operacion);
            }
          },
          terminarLote: flush,
        },
      );
      const ultimoDia = new Date(`${periodo}-01T00:00:00Z`);
      ultimoDia.setUTCMonth(ultimoDia.getUTCMonth() + 1, 0);
      if (
        dias.size !== ultimoDia.getUTCDate() ||
        descartadas !== sinCorrespondencia ||
        procesadas <= descartadas
      )
        throw new UnrecoverableError(
          'Mes incompleto: revisar descartes y correspondencias BTS',
        );
      const checksumFuente = hash.copy().digest('hex');
      return await db.transaction(async (tx) => {
        await this.bloquear(tx);
        const activa = await tx.orm.public.EjecucionEtl.where({
          id: ejecucionId,
          intento,
          estado: 'running',
          listaParaPublicar: false,
        })
          .select('id')
          .forUpdate()
          .first();
        if (!activa)
          throw new ConflictException('La ejecución BTS cambió de estado');
        const insertadas = await this.importarOperacionesPreparadas(
          tx,
          ejecucionId,
        );
        const listaParaPublicar = descartadas === 0;
        await tx.orm.public.EjecucionEtl.where({
          id: ejecucionId,
          intento,
        }).update({
          estado: listaParaPublicar ? 'running' : 'completed',
          listaParaPublicar,
          finalizadoEn: listaParaPublicar ? null : now(),
          filasTotales: total,
          filasProcesadas: procesadas,
          filasInsertadas: insertadas,
          filasDescartadas: descartadas,
          checksumFuente,
        });
        await tx.orm.public.EventoEjecucionEtl.create({
          ejecucionId,
          intento,
          nivel: listaParaPublicar ? 'info' : 'warn',
          mensaje: `Mes BTS ${periodo}: ${procesadas} operaciones aceptadas. ${resumenDescartes()}`,
        });
        await tx.orm.public.PreparacionBts.where({
          ejecucionId,
        }).deleteAndCount();
        return { procesadas, insertadas, descartadas };
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message.slice(0, 500) : 'Falló BTS';
      const reintenta =
        quedanIntentos && !(error instanceof UnrecoverableError);
      await this.prisma.models.EjecucionEtl.where({
        id: ejecucionId,
        intento,
        estado: 'running',
      }).update({
        estado: reintenta ? 'running' : 'failed',
        finalizadoEn: reintenta ? null : now(),
        filasTotales: total,
        filasProcesadas: procesadas,
        filasDescartadas: descartadas,
        checksumFuente: hash.digest('hex'),
        mensajeError: mensaje,
      });
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento,
        nivel: 'error',
        mensaje: `${mensaje}. ${resumenDescartes()}`,
      });
      await this.prisma.models.PreparacionBts.where({
        ejecucionId,
      }).deleteAndCount();
      throw error;
    }
  }
  private async leerCorrespondenciasLote(batch: OperacionBts[]) {
    const aeropuertos = [
      ...new Set(batch.flatMap((fila) => [fila.origenBts, fila.destinoBts])),
    ];
    const operadores = [...new Set(batch.map((fila) => fila.operadorBts))];
    const [coincidenciasAeropuerto, coincidenciasOperador] = await Promise.all([
      this.prisma.models.IdentidadAeropuertoFuente.where({ fuente: 'BTS' })
        .where((i) => i.identificador.in(aeropuertos))
        .select('identificador', 'aeropuertoId')
        .all(),
      this.prisma.models.IdentidadOperadorBts.where((i) =>
        i.identificador.in(operadores),
      )
        .select('identificador', 'aerolineaId')
        .all(),
    ]);
    return {
      aeropuertos: new Map(
        coincidenciasAeropuerto.map((i) => [i.identificador, i.aeropuertoId]),
      ),
      operadores: new Map(
        coincidenciasOperador.map((i) => [i.identificador, i.aerolineaId]),
      ),
    };
  }

  private async importarOperacionesPreparadas(
    tx: Transaction,
    ejecucionId: string,
  ) {
    let cursor = '',
      insertadas = 0;
    for (;;) {
      const rows = await tx.orm.public.PreparacionBts.where({ ejecucionId })
        .where((fila) => fila.identidad.gt(cursor))
        .select('identidad', 'observacion')
        .orderBy((fila) => fila.identidad.asc())
        .limit(1000)
        .all();
      if (!rows.length) break;
      const observations = rows.map(({ identidad, observacion }) =>
        this.operacionPreparada(identidad, observacion),
      );
      insertadas += (
        await this.vuelos.importarLote(observations, ejecucionId, tx)
      ).insertadas;
      cursor = rows[rows.length - 1].identidad;
    }
    return insertadas;
  }

  private operacionPreparada(identidad: string, observacion: unknown) {
    if (!observacion || typeof observacion !== 'object')
      throw new Error('Registro BTS preparado inválido');
    const {
      fechaVuelo,
      numeroVuelo,
      origenId,
      destinoId,
      aerolineaId,
      estado,
      demoraLlegadaMinutos,
    } = observacion as Record<string, unknown>;
    if (
      typeof fechaVuelo !== 'string' ||
      typeof numeroVuelo !== 'string' ||
      typeof origenId !== 'string' ||
      typeof destinoId !== 'string' ||
      typeof aerolineaId !== 'string' ||
      (estado !== 'ARRIVED' &&
        estado !== 'CANCELLED' &&
        estado !== 'DIVERTED') ||
      (demoraLlegadaMinutos !== null &&
        typeof demoraLlegadaMinutos !== 'number')
    )
      throw new Error('Registro BTS preparado inválido');

    return {
      fechaVuelo,
      numeroVuelo,
      origenId,
      destinoId,
      aerolineaId,
      estado,
      demoraLlegadaMinutos,
      horarios: fechaInformadaBts,
      fuente: 'BTS',
      idRegistroFuente: identidad,
    } satisfies ObservacionVuelo;
  }

  private publicar(id: string, intento: number, periodo: string) {
    return this.prisma.db.transaction(async (tx) => {
      await bloquearCambiosMetricas(tx);
      const job = await tx.orm.public.EjecucionEtl.where({
        id,
        intento,
        estado: 'running',
        listaParaPublicar: true,
      })
        .forUpdate()
        .first();
      if (!job) return;

      const autorizadas =
        (
          job.instantaneaConfiguracion as {
            conexion?: { autorizarCambioFuente?: PoblacionBtsDto[] };
          } | null
        )?.conexion?.autorizarCambioFuente ?? [];
      const clave = ({ origenId, destinoId, aerolineaId }: PoblacionBtsDto) =>
        JSON.stringify([origenId, destinoId, aerolineaId]);
      const permiso = new Set(autorizadas.map(clave));
      await publicarPoblacionesCandidatas(tx, periodo, id, 'BTS', (poblacion) =>
        permiso.has(clave(poblacion)),
      );

      await tx.orm.public.CoberturaBts.upsert({
        create: { periodo, ejecucionId: id, filas: job.filasProcesadas },
        update: {
          ejecucionId: id,
          filas: job.filasProcesadas,
          publicadoEn: now(),
        },
      });
      await tx.orm.public.EjecucionEtl.where({ id }).update({
        estado: 'completed',
        mensajeError: null,
        listaParaPublicar: false,
        finalizadoEn: now(),
      });
      await tx.orm.public.EventoEjecucionEtl.create({
        ejecucionId: id,
        intento,
        nivel: 'success',
        mensaje: `BTS ${periodo} publicado: ${job.filasProcesadas} operaciones`,
      });
    });
  }
}

export function urlBts(periodo: string) {
  const [year, month] = periodo.split('-');
  return `https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_${year}_${Number(month)}.zip`;
}

function periodoDe(job: { instantaneaConfiguracion: unknown }) {
  const snapshot = job.instantaneaConfiguracion as {
    conexion?: { periodo?: unknown };
  } | null;
  const periodo = snapshot?.conexion?.periodo;
  return typeof periodo === 'string' &&
    /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(periodo)
    ? periodo
    : null;
}
