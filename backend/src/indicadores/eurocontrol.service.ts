import { timestampToJson, ultimoDiaDelMes } from '../prisma/timestamp.js';
import { FunctionCallExpr } from '@prisma/orm-postgres/relational-core/ast';
import { ExpressionImpl } from '@prisma/orm-postgres/relational-core/expression';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { PrismaService } from '../prisma/prisma.service.js';
import { openCsvSource } from '../etl/http-source.js';
import { readEurocontrolWorkbook } from '../adapters/eurocontrol/eurocontrol-workbook.js';
import {
  EUROCONTROL_PRODUCTS,
  type ConsultaIndicadoresDto,
  type EurocontrolProduct,
} from './indicadores.dto.js';
const URLS = {
  network:
    'https://www.eurocontrol.int/Economics/Download/Network_Punctuality.xlsx',
  stakeholder:
    'https://www.eurocontrol.int/Economics/Download/Stakeholder_Punctuality.xlsx',
};
@Injectable()
export class EurocontrolService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('eurocontrol-queue') private readonly queue: Queue,
  ) {}
  async onModuleInit() {
    for (const producto of EUROCONTROL_PRODUCTS)
      await this.queue.upsertJobScheduler(
        `eurocontrol-${producto}`,
        { pattern: '0 4 1 * *', tz: 'UTC' },
        {
          name: 'scheduled-eurocontrol',
          data: { producto },
          opts: {
            attempts: 1,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 100 },
          },
        },
      );
    await this.recoverJobs();
  }
  private async recoverJobs() {
    for (const producto of EUROCONTROL_PRODUCTS) {
      let cursor = '';
      for (;;) {
        const executions = await this.prisma.models.EjecucionEtl.where({
          fuente: `EUROCONTROL:${producto}`,
        })
          .where((row) => row.estado.in(['pending', 'running']))
          .where((row) => row.id.gt(cursor))
          .select('id')
          .orderBy((row) => row.id.asc())
          .limit(100)
          .all();
        for (const { id } of executions) {
          const job = await this.queue.getJob(id);
          const state = await job?.getState();
          if (job && (state === 'completed' || state === 'failed')) {
            try {
              await job.retry(state, {
                resetAttemptsMade: true,
                resetAttemptsStarted: true,
              });
            } catch (error) {
              if ((await job.getState()) === state) throw error;
            }
          } else if (state === undefined || state === 'unknown') {
            await this.addJob(producto, id);
          }
        }
        if (executions.length < 100) break;
        cursor = executions[executions.length - 1].id;
      }
    }
  }
  private addJob(producto: EurocontrolProduct, ejecucionId: string) {
    return this.queue.add(
      'import-eurocontrol',
      { producto, ejecucionId },
      {
        jobId: ejecucionId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );
  }
  async sources() {
    const { db, models } = this.prisma;
    const programaciones = await models.EurocontrolProgramacion.select(
      'producto',
      'pausado',
    )
      .orderBy((p) => p.producto.asc())
      .all();
    const tablas = db.sql.public;
    return Promise.all(
      programaciones.map(async (programacion) => {
        const [ejecucion] = await db.query(
          tablas.ejecuciones_etl
            .as('ejecucion')
            .outerLateralJoin('registro', (lateral) =>
              lateral
                .from(tablas.eventos_ejecucion_etl.as('evento'))
                .select('creado_en', (f, sql) => sql.min(f.evento.creado_en))
                .where((f, sql) =>
                  sql.and(
                    sql.eq(f.evento.ejecucion_id, f.ejecucion.id),
                    sql.eq(f.evento.intento, 0),
                  ),
                ),
            )
            .select(
              'id',
              'fuente',
              'estado',
              'intento',
              'filas_totales',
              'filas_procesadas',
              'filas_insertadas',
              'filas_descartadas',
              'iniciado_en',
              'finalizado_en',
              'mensaje_error',
              'proceso_id',
              'solicitante_id',
              'instantanea_configuracion',
              'uri_fuente',
              'checksum_fuente',
            )
            .where((f, sql) =>
              sql.eq(
                f.ejecucion.fuente,
                `EUROCONTROL:${programacion.producto}`,
              ),
            )
            .orderBy(
              (f) =>
                new ExpressionImpl(
                  FunctionCallExpr.of('coalesce', [
                    f.registro.creado_en.buildAst(),
                    f.ejecucion.iniciado_en.buildAst(),
                  ]),
                  f.ejecucion.iniciado_en.returnType,
                ),
              { direction: 'desc', nulls: 'last' },
            )
            .orderBy('id', { direction: 'desc' })
            .limit(1)
            .build(),
        );
        return {
          ...programacion,
          programacionUtc: '0 4 1 * *',
          ultimaEjecucion: ejecucion
            ? {
                ...ejecucion,
                iniciado_en:
                  ejecucion.iniciado_en &&
                  timestampToJson(ejecucion.iniciado_en),
                finalizado_en:
                  ejecucion.finalizado_en &&
                  timestampToJson(ejecucion.finalizado_en),
              }
            : null,
        };
      }),
    );
  }

  async schedule(producto: EurocontrolProduct, pausado: boolean) {
    await this.prisma.models.EurocontrolProgramacion.where({ producto }).update(
      {
        pausado,
        actualizadoEn: new Date().toISOString().slice(0, -1).replace('T', ' '),
      },
    );
    return { producto, pausado, programacionUtc: '0 4 1 * *' };
  }
  async enqueue(
    producto: EurocontrolProduct,
    solicitanteId?: string,
    scheduled = false,
  ) {
    if (scheduled) {
      const state = await this.prisma.models.EurocontrolProgramacion.where({
        producto,
      })
        .select('pausado')
        .first();
      if (!state || state.pausado) return { pausado: true };
    }
    const job = await this.prisma.db.transaction(async (tx) => {
      const job = await tx.orm.public.EjecucionEtl.create({
        fuente: `EUROCONTROL:${producto}`,
        estado: 'pending',
        solicitanteId,
        uriFuente: URLS[producto],
      });
      await tx.orm.public.EventoEjecucionEtl.create({
        ejecucionId: job.id,
        intento: 0,
        nivel: 'info',
        mensaje: 'Ejecución EUROCONTROL solicitada',
        creadoEn: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      });
      return job;
    });
    try {
      await this.addJob(producto, job.id);
    } catch {
      await this.prisma.models.EjecucionEtl.where({ id: job.id }).update({
        estado: 'failed',
        mensajeError: 'No fue posible encolar EUROCONTROL',
      });
      throw new BadRequestException('No fue posible encolar EUROCONTROL');
    }
    return { ejecucionId: job.id };
  }
  async retry(id: string, solicitanteId?: string) {
    const job = await this.prisma.models.EjecucionEtl.first({ id });
    if (!job || !job.fuente.startsWith('EUROCONTROL:'))
      throw new NotFoundException('Ejecución EUROCONTROL no encontrada');
    if (job.estado !== 'failed')
      throw new BadRequestException('Sólo se reintentan ejecuciones fallidas');
    return this.enqueue(
      job.fuente.slice('EUROCONTROL:'.length) as EurocontrolProduct,
      solicitanteId,
    );
  }
  async download(producto: EurocontrolProduct) {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-eurocontrol-'));
    const path = join(directory, 'source.xlsx');
    try {
      const source = await openCsvSource(
        {
          tipoFuente: 'http_stream',
          urlEndpoint: URLS[producto],
          metodoHttp: 'GET',
          formatoDatos: 'csv',
        },
        120,
        ['www.eurocontrol.int'],
      );
      let bytes = 0;
      await pipeline(
        source,
        async function* (chunks: AsyncIterable<Buffer>) {
          for await (const chunk of chunks) {
            bytes += chunk.length;
            if (bytes > 32 * 1024 * 1024)
              throw new Error('EUROCONTROL supera 32 MiB');
            yield chunk;
          }
        },
        createWriteStream(path, { flags: 'wx' }),
      );
      return {
        path,
        cleanup: () => rm(directory, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
  private async prepararInstantanea(
    ejecucionId: string,
    producto: EurocontrolProduct,
    checksum: string,
  ) {
    const id = randomUUID();
    await this.prisma.models.InstantaneaIndicador.createAndCount(
      [{ id, producto, ejecucionId, checksum, uri: URLS[producto] }],
      { onConflict: 'skip' },
    );
    const snapshot = await this.prisma.models.InstantaneaIndicador.select(
      'id',
      'publicada',
    ).firstOrThrow({ ejecucionId });
    if (snapshot.publicada)
      throw new BadRequestException(
        'La ejecución ya tiene una instantánea publicada',
      );
    await this.prisma.models.IndicadorExterno.where({
      instantaneaId: snapshot.id,
    }).deleteAndCount();
    return snapshot;
  }

  async importWorkbook(
    producto: EurocontrolProduct,
    path: string,
    ejecucionId: string,
  ) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id: ejecucionId,
    });
    if (
      !job ||
      job.estado !== 'running' ||
      job.fuente !== `EUROCONTROL:${producto}`
    )
      throw new BadRequestException('Ejecución EUROCONTROL incompatible');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path))
      hash.update(chunk as Buffer);
    const checksum = hash.digest('hex');
    const snapshot = await this.prepararInstantanea(
      ejecucionId,
      producto,
      checksum,
    );
    let processed = 0;
    const result = await readEurocontrolWorkbook(
      path,
      producto,
      async (rows) => {
        await this.prisma.models.IndicadorExterno.createAndCount(
          rows.map((row) => ({ ...row, instantaneaId: snapshot.id })),
        );
        processed += rows.length;
        await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update(
          {
            filasTotales: processed,
            filasProcesadas: processed,
            filasInsertadas: processed,
          },
        );
      },
    );
    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.InstantaneaIndicador.where({
        id: snapshot.id,
      }).update({
        publicada: true,
        creadoEn: new Date().toISOString().slice(0, -1).replace('T', ' '),
        checksum,
        aviso: result.aviso,
        metodologia: result.metadata,
      });
      await tx.orm.public.EjecucionEtl.where({ id: ejecucionId }).update({
        estado: 'completed',
        finalizadoEn: new Date()
          .toISOString()
          .replace('T', ' ')
          .replace('Z', ''),
        checksumFuente: checksum,
        filasTotales: result.total,
        filasProcesadas: result.total,
        filasInsertadas: result.total,
      });
      await tx.orm.public.EventoEjecucionEtl.create({
        ejecucionId,
        intento: job.intento,
        nivel: 'success',
        mensaje: `Instantánea completa: ${result.total} indicadores nativos, 0 descartes`,
      });
    });
    return {
      instantaneaId: snapshot.id,
      processed: result.total,
      discarded: 0,
    };
  }
  async list(query: ConsultaIndicadoresDto) {
    const { producto, ambito, entidad, granularidad, mes, instantaneaId } =
      query;
    if (mes?.startsWith('0000-')) return { total: 0, datos: [] };

    const { InstantaneaIndicador, IndicadorExterno } = this.prisma.models;
    const instantaneas = await InstantaneaIndicador.where({
      publicada: true,
      ...(producto && { producto }),
      ...(instantaneaId && { id: instantaneaId }),
    })
      .orderBy([
        (i) => i.producto.asc(),
        (i) => i.creadoEn.desc(),
        (i) => i.id.desc(),
      ])
      .distinctOn('producto')
      .all();
    if (!instantaneas.length) return { total: 0, datos: [] };

    const porId = new Map(instantaneas.map((i) => [i.id, i]));
    let filtrados = IndicadorExterno.where({
      ...(ambito && { ambito }),
      ...(entidad && { entidad }),
      ...(granularidad && { granularidad }),
    }).where((i) => i.instantaneaId.in([...porId.keys()]));
    if (mes) {
      const desde = mes + '-01';
      filtrados = filtrados
        .where((i) => i.hasta.gte(desde))
        .where((i) => i.hasta.lte(ultimoDiaDelMes(desde)));
    }

    const [pagina, { total }] = await Promise.all([
      filtrados
        .orderBy([
          (i) => i.hasta.desc(),
          (i) => i.ambito.asc(),
          (i) => i.entidad.asc(),
          (i) => i.granularidad.asc(),
          (i) => i.instantaneaId.asc(),
        ])
        .offset((query.pagina - 1) * query.limite)
        .limit(query.limite)
        .all(),
      filtrados.aggregate((i) => ({ total: i.count() })),
    ]);
    return {
      total,
      datos: pagina.map((indicador) => {
        const instantanea = porId.get(indicador.instantaneaId)!;
        return {
          ...indicador,
          producto: instantanea.producto,
          fuente: 'EUROCONTROL',
          atribucion: instantanea.atribucion,
          aviso: instantanea.aviso,
          metodologia: instantanea.metodologia,
          uri: instantanea.uri,
          actualizadoEn: timestampToJson(instantanea.creadoEn),
        };
      }),
    };
  }

  async snapshots(query: ConsultaIndicadoresDto) {
    let publicadas = this.prisma.models.InstantaneaIndicador.where({
      publicada: true,
    });
    if (query.producto)
      publicadas = publicadas.where({ producto: query.producto });
    const [pagina, { total }] = await Promise.all([
      publicadas
        .select('id', 'producto', 'creadoEn', 'checksum', 'ejecucionId')
        .orderBy([(i) => i.creadoEn.desc(), (i) => i.id.desc()])
        .offset((query.pagina - 1) * query.limite)
        .limit(query.limite)
        .all(),
      publicadas.aggregate((i) => ({ total: i.count() })),
    ]);

    return {
      total,
      datos: pagina.map(({ creadoEn, ...fila }) => ({
        ...fila,
        actualizadoEn: timestampToJson(creadoEn),
      })),
    };
  }
}
