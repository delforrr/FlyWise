import { bloquearRecurso } from '../prisma/bloqueo-transaccional.js';
import { admiteFuente } from '../metrics/domain/autoridad-publicacion.js';
import { exigirIngestaDisponible } from '../ingestion/infrastructure/admision-operaciones.js';
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
import { retirarAusentesBts } from './retiros-bts.js';
import { escribirPublicacion } from '../metrics/publicacion.store.js';
import { VuelosService } from '../vuelos/vuelos.service.js';
import type { Operacion } from '../entities/vuelos/domain/operacion.js';

const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
@Injectable()
export class BtsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('bts-queue') private readonly queue: Queue,
    private readonly vuelos: VuelosService,
    @Inject(ADAPTADOR_BTS)
    private readonly adaptador: AdaptadorOperaciones<LecturaBts, OperacionBts>,
  ) {}
  async onModuleInit() {
    await this.schedule(await this.configuracion());
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
        if (!periodo) continue;
        const queued = await this.queue.getJob(job.id);
        if (!queued) await this.encolar(job.id, periodo);
        else if ((await queued.getState()) === 'failed') {
          await this.prisma.models.EjecucionEtl.where({ id: job.id })
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
    const db = this.prisma.db;
    const rows = await db.query(
      db.raw
        .sql`SELECT periodo,pausado,expresion_cron AS cron FROM configuracion_bts WHERE id`
        .returnsRow({
          periodo: 'pg/text@1',
          pausado: 'pg/bool@1',
          cron: 'pg/text@1',
        })
        .build(),
    );
    const row = rows[0];
    return row
      ? { periodo: row.periodo, pausado: row.pausado, expresionCron: row.cron }
      : { periodo: '', pausado: true, expresionCron: '' };
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
    const db = this.prisma.db;
    await db.execute(
      db.raw
        .sql`INSERT INTO configuracion_bts(id,periodo,pausado,expresion_cron)
      VALUES(true,${dto.periodo},${dto.pausado},${dto.expresionCron})
      ON CONFLICT(id) DO UPDATE SET periodo=EXCLUDED.periodo,pausado=EXCLUDED.pausado,expresion_cron=EXCLUDED.expresion_cron`
        .affectedCount()
        .build(),
    );
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
      await exigirIngestaDisponible(tx);
      return tx.orm.public.EjecucionEtl.create({
        fuente: 'BTS',
        estado: 'pending',
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
      return { ejecucionId: record.id };
    } catch {
      await this.prisma.models.EjecucionEtl.where({ id: record.id }).update({
        estado: 'failed',
        mensajeError: 'No fue posible encolar BTS',
      });
      throw new BadRequestException('No fue posible encolar BTS');
    }
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
    return this.ejecutar(periodo, solicitanteId, true);
  }
  async cobertura() {
    const db = this.prisma.db;
    return db.query(
      db.raw
        .sql`SELECT periodo,ejecucion_id AS "ejecucionId",filas,publicado_en::text AS "publicadoEn",e.filas_descartadas AS descartadas FROM cobertura_bts c JOIN ejecuciones_etl e ON e.id=c.ejecucion_id ORDER BY periodo DESC LIMIT 100`
        .returnsRow({
          periodo: 'pg/text@1',
          ejecucionId: 'pg/text@1',
          filas: 'pg/int4@1',
          publicadoEn: 'pg/text@1',
          descartadas: 'pg/int4@1',
        })
        .build(),
    );
  }
  async pendientes(dto: ConsultaBtsDto) {
    const db = this.prisma.db;
    const rows =
      dto.tipo === 'operadores'
        ? await db.query(
            db.raw
              .sql`SELECT identificador,codigo,count(*) OVER()::int AS total FROM identidades_operador_bts WHERE aerolinea_id IS NULL ORDER BY identificador LIMIT ${dto.limite} OFFSET ${(dto.pagina - 1) * dto.limite}`
              .returnsRow({
                identificador: 'pg/text@1',
                codigo: 'pg/text@1',
                total: 'pg/int4@1',
              })
              .build(),
          )
        : await db.query(
            db.raw
              .sql`SELECT identificador,COALESCE(observacion->>'codigo','') AS codigo,count(*) OVER()::int AS total FROM identidades_aeropuerto_fuente WHERE fuente='BTS' AND aeropuerto_id IS NULL ORDER BY identificador LIMIT ${dto.limite} OFFSET ${(dto.pagina - 1) * dto.limite}`
              .returnsRow({
                identificador: 'pg/text@1',
                codigo: 'pg/text@1',
                total: 'pg/int4@1',
              })
              .build(),
          );
    return {
      datos: rows.map(({ identificador, codigo }) => ({
        identificador,
        codigo,
      })),
      total: rows[0]?.total ?? 0,
      pagina: dto.pagina,
      limite: dto.limite,
    };
  }
  async resolver(dto: CorrespondenciaBtsDto) {
    return this.prisma.db.transaction(async (db) => {
      await this.bloquear(db);
      const entity =
        dto.tipo === 'operadores'
          ? await db.orm.public.Aerolinea.first({
              id: dto.entidadId,
              archivadoEn: null,
            })
          : await db.orm.public.Aeropuerto.first({
              id: dto.entidadId,
              archivadoEn: null,
            });
      if (!entity)
        throw new BadRequestException('Entidad inexistente o archivada');
      const changed =
        dto.tipo === 'operadores'
          ? await db.query(
              db.raw
                .sql`UPDATE identidades_operador_bts SET aerolinea_id=${dto.entidadId} WHERE identificador=${dto.identificador} AND (aerolinea_id IS NULL OR aerolinea_id=${dto.entidadId}) RETURNING identificador`
                .returnsRow({ identificador: 'pg/text@1' })
                .build(),
            )
          : await db.query(
              db.raw
                .sql`UPDATE identidades_aeropuerto_fuente SET aeropuerto_id=${dto.entidadId}
              WHERE fuente='BTS' AND identificador=${dto.identificador} AND (aeropuerto_id IS NULL OR aeropuerto_id=${dto.entidadId})
              AND NOT EXISTS(SELECT 1 FROM identidades_aeropuerto_fuente AS otra
                WHERE otra.fuente='BTS' AND otra.aeropuerto_id=${dto.entidadId} AND otra.identificador<>${dto.identificador})
              RETURNING identificador`
                .returnsRow({ identificador: 'pg/text@1' })
                .build(),
            );
      if (!changed.length)
        throw new ConflictException(
          'Correspondencia inexistente, ya resuelta o aeropuerto vinculado a otra identidad BTS',
        );
      return { resuelto: true };
    });
  }
  async importar(ejecucionId: string, periodo: string, path?: string) {
    let download: Awaited<ReturnType<typeof descargarBts>> | undefined;
    let csvSource: Awaited<ReturnType<typeof abrirCsvBts>> | undefined;
    try {
      return await this.procesar(ejecucionId, periodo, async () => {
        if (!path) {
          download = await descargarBts(urlBts(periodo));
          path = download.path;
        }
        csvSource = await abrirCsvBts(path);
        return csvSource.stream;
      });
    } finally {
      csvSource?.close();
      await download?.cleanup();
    }
  }

  async procesar(
    ejecucionId: string,
    periodo: string,
    source: Readable | (() => Promise<Readable>),
  ) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id: ejecucionId,
      fuente: 'BTS',
    });
    if (!job) throw new NotFoundException('Ejecución BTS inexistente');
    if (job.estado === 'completed')
      return {
        procesadas: job.filasProcesadas,
        insertadas: job.filasInsertadas,
        descartadas: job.filasDescartadas,
      };
    const autorizadas =
      (
        job.instantaneaConfiguracion as {
          conexion?: { autorizarCambioFuente?: PoblacionBtsDto[] };
        } | null
      )?.conexion?.autorizarCambioFuente ?? [];
    const intento = job.intento + 1;
    const db = this.prisma.db;
    await db.transaction(async (tx) => {
      if (job.estado === 'failed') await exigirIngestaDisponible(tx);
      const iniciada = await tx.orm.public.EjecucionEtl.where({
        id: ejecucionId,
        estado: job.estado,
        intento: job.intento,
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
    await db.execute(
      db.raw.sql`DELETE FROM preparacion_bts WHERE ejecucion_id=${ejecucionId}`
        .affectedCount()
        .build(),
    );
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
      const resolved = await db.query(
        db.raw
          .sql`SELECT x.identidad,COALESCE(o.aeropuerto_id,'') AS origen,COALESCE(d.aeropuerto_id,'') AS destino,COALESCE(a.aerolinea_id,'') AS operador
        FROM jsonb_to_recordset(${input}::jsonb) x(identidad text,"origenBts" text,"destinoBts" text,"operadorBts" text)
        LEFT JOIN identidades_aeropuerto_fuente o ON o.fuente='BTS' AND o.identificador=x."origenBts"
        LEFT JOIN identidades_aeropuerto_fuente d ON d.fuente='BTS' AND d.identificador=x."destinoBts"
        LEFT JOIN identidades_operador_bts a ON a.identificador=x."operadorBts"`
          .returnsRow({
            identidad: 'pg/text@1',
            origen: 'pg/text@1',
            destino: 'pg/text@1',
            operador: 'pg/text@1',
          })
          .build(),
      );
      const ids = new Map(resolved.map((row) => [row.identidad, row]));
      const accepted: (OperacionBts & {
        origenId: string;
        destinoId: string;
        aerolineaId: string;
      })[] = [];
      for (const row of batch) {
        const identity = ids.get(row.identidad);
        if (!identity?.origen || !identity.destino || !identity.operador) {
          sinCorrespondencia++;
          await discard(
            row.numeroFila,
            'identidad',
            'Faltan correspondencias BTS explícitas',
            row,
          );
          continue;
        }
        accepted.push({
          ...row,
          origenId: identity.origen,
          destinoId: identity.destino,
          aerolineaId: identity.operador,
        });
      }
      if (accepted.length) {
        const staged = await db.query(
          db.raw
            .sql`INSERT INTO preparacion_bts(ejecucion_id,identidad,numero_fila,observacion)
        SELECT ${ejecucionId},x->>'identidad',(x->>'numeroFila')::int,x FROM jsonb_array_elements(${JSON.stringify(accepted)}::jsonb) x
        ON CONFLICT DO NOTHING RETURNING numero_fila AS "numeroFila"`
            .returnsRow({ numeroFila: 'pg/int4@1' })
            .build(),
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
        const insertadas = await this.importarOperacionesPreparadas(
          tx,
          ejecucionId,
        );
        if (descartadas)
          await this.conservarPublicacionBts(tx, periodo, ejecucionId);
        else await this.publicarMesBts(tx, periodo, ejecucionId, autorizadas);
        await tx.execute(
          tx.raw
            .sql`INSERT INTO cobertura_bts(periodo,ejecucion_id,filas) VALUES(${periodo},${ejecucionId},${procesadas})
          ON CONFLICT(periodo) DO UPDATE SET ejecucion_id=EXCLUDED.ejecucion_id,filas=EXCLUDED.filas,publicado_en=CURRENT_TIMESTAMP`
            .affectedCount()
            .build(),
        );
        await tx.orm.public.EjecucionEtl.where({ id: ejecucionId }).update({
          estado: 'completed',
          finalizadoEn: now(),
          filasTotales: total,
          filasProcesadas: procesadas,
          filasInsertadas: insertadas,
          filasDescartadas: descartadas,
          checksumFuente,
        });
        await tx.orm.public.EventoEjecucionEtl.create({
          ejecucionId,
          intento,
          nivel: 'success',
          mensaje: `Mes BTS ${periodo}: ${procesadas} operaciones aceptadas. ${resumenDescartes()}`,
        });
        await tx.execute(
          tx.raw
            .sql`DELETE FROM preparacion_bts WHERE ejecucion_id=${ejecucionId}`
            .affectedCount()
            .build(),
        );
        return { procesadas, insertadas, descartadas };
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message.slice(0, 500) : 'Falló BTS';
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        estado: 'failed',
        finalizadoEn: now(),
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
      await db.execute(
        db.raw
          .sql`DELETE FROM preparacion_bts WHERE ejecucion_id=${ejecucionId}`
          .affectedCount()
          .build(),
      );
      throw error;
    }
  }
  private async importarOperacionesPreparadas(
    tx: Transaction,
    ejecucionId: string,
  ) {
    let cursor = '',
      insertadas = 0;
    for (;;) {
      const rows = await tx.query(
        tx.raw.sql`SELECT identidad, observacion->>'fechaVuelo' AS "fechaVuelo",
                observacion->>'numeroVuelo' AS "numeroVuelo", observacion->>'origenId' AS "origenId",
                observacion->>'destinoId' AS "destinoId", observacion->>'aerolineaId' AS "aerolineaId",
                observacion->>'estado' AS estado, (observacion->>'demoraLlegadaMinutos')::int AS "demoraLlegadaMinutos"
                FROM preparacion_bts WHERE ejecucion_id=${ejecucionId} AND identidad>${cursor}
                ORDER BY identidad LIMIT 1000`
          .returnsRow({
            identidad: 'pg/text@1',
            fechaVuelo: 'pg/text@1',
            numeroVuelo: 'pg/text@1',
            origenId: 'pg/text@1',
            destinoId: 'pg/text@1',
            aerolineaId: 'pg/text@1',
            estado: 'pg/text@1',
            demoraLlegadaMinutos: { codecId: 'pg/int4@1', nullable: true },
          })
          .build(),
      );
      if (!rows.length) break;
      const observations = rows.map(({ identidad, estado, ...operacion }) => ({
        ...operacion,
        estado: estado as Operacion['estado'],
        horarios: fechaInformadaBts,
        fuente: 'BTS',
        idRegistroFuente: identidad,
      }));
      insertadas += (
        await this.vuelos.importarLote(observations, ejecucionId, tx)
      ).insertadas;
      cursor = rows[rows.length - 1].identidad;
    }
    return insertadas;
  }

  private async conservarPublicacionBts(
    tx: Transaction,
    periodo: string,
    ejecucionId: string,
  ) {
    const [cobertura] = await tx.query(
      tx.raw.sql`SELECT e.filas_descartadas AS descartadas FROM cobertura_bts c
            JOIN ejecuciones_etl e ON e.id=c.ejecucion_id WHERE c.periodo=${periodo}`
        .returnsRow({ descartadas: 'pg/int4@1' })
        .build(),
    );
    if (cobertura)
      throw new UnrecoverableError(
        'La nueva carga parcial conserva la publicación anterior',
      );
    await tx.execute(
      tx.raw.sql`
              UPDATE metricas_ruta m SET pendiente=false,error_actualizacion=NULL
              WHERE m.periodo=${periodo + '-01'}::date AND EXISTS (
                SELECT 1 FROM vuelos v WHERE v.ejecucion_etl_id=${ejecucionId}
                  AND (v.origen_id,v.destino_id,v.aerolinea_id)=(m.origen_id,m.destino_id,m.aerolinea_id)
              )
            `
        .affectedCount()
        .build(),
    );
  }

  private async publicarMesBts(
    tx: Transaction,
    periodo: string,
    ejecucionId: string,
    autorizadas: PoblacionBtsDto[],
  ) {
    await retirarAusentesBts(tx, periodo, ejecucionId);
    const clavePoblacion = ({
      origenId,
      destinoId,
      aerolineaId,
    }: PoblacionBtsDto) => JSON.stringify([origenId, destinoId, aerolineaId]);
    const conAutorizacion = new Set(autorizadas.map(clavePoblacion));
    let cursor = { origenId: '', destinoId: '', aerolineaId: '' };
    for (;;) {
      const poblaciones = await tx.query(
        tx.raw.sql`
                SELECT m.origen_id AS "origenId",m.destino_id AS "destinoId",m.aerolinea_id AS "aerolineaId",
                  e.fuente, m.ejecucion_etl_id AS "ejecucionId",
                  m.actualizado_en IS NOT NULL AS actualizada, m.vuelos_totales AS "vuelosTotales", m.fuentes, COALESCE(observada.existe, false) AS observada
                FROM metricas_ruta m LEFT JOIN ejecuciones_etl e ON e.id=m.ejecucion_etl_id
                LEFT JOIN LATERAL (
                  SELECT true AS existe FROM vuelos v
                  WHERE v.ejecucion_etl_id=${ejecucionId} AND v.fuente='BTS'
                    AND (v.origen_id,v.destino_id,v.aerolinea_id)=(m.origen_id,m.destino_id,m.aerolinea_id)
                  LIMIT 1
                ) observada ON true
                WHERE m.periodo=${periodo + '-01'}::date AND m.pendiente
                  AND (m.ejecucion_etl_id IS NOT NULL OR observada.existe)
                  AND (m.origen_id,m.destino_id,m.aerolinea_id)>(${cursor.origenId},${cursor.destinoId},${cursor.aerolineaId})
                ORDER BY m.origen_id,m.destino_id,m.aerolinea_id LIMIT 100
              `
          .returnsRow({
            origenId: 'pg/text@1',
            destinoId: 'pg/text@1',
            aerolineaId: 'pg/text@1',
            fuente: { codecId: 'pg/text@1', nullable: true },
            ejecucionId: { codecId: 'pg/text@1', nullable: true },
            actualizada: 'pg/bool@1',
            vuelosTotales: 'pg/int4@1',
            fuentes: 'pg/jsonb@1',
            observada: 'pg/bool@1',
          })
          .build(),
      );
      for (const actual of poblaciones) {
        const { origenId, destinoId, aerolineaId } = actual;
        const poblacion = { origenId, destinoId, aerolineaId };
        if (actual.fuente !== 'BTS' && !actual.observada) continue;
        if (
          !admiteFuente(
            actual,
            'BTS',
            conAutorizacion.has(clavePoblacion(poblacion)),
          )
        )
          continue;
        await escribirPublicacion(
          tx,
          { ...poblacion, periodo },
          { fuente: 'BTS', ejecucionId },
        );
      }
      if (poblaciones.length < 100) break;
      cursor = poblaciones[poblaciones.length - 1];
    }
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
