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
    const rows = await this.prisma.db.query(
      this.prisma.db.raw
        .sql`SELECT jsonb_build_object('producto',p.producto,'pausado',p.pausado,'programacionUtc','0 4 1 * *','ultimaEjecucion',(
          SELECT to_jsonb(e) FROM ejecuciones_etl e WHERE e.fuente='EUROCONTROL:'||p.producto
          ORDER BY COALESCE((SELECT min(ev.creado_en) FROM eventos_ejecucion_etl ev WHERE ev.ejecucion_id=e.id AND ev.intento=0),e.iniciado_en) DESC NULLS LAST,e.id DESC LIMIT 1
        )) AS dato FROM eurocontrol_programacion p ORDER BY producto`
        .returnsRow({ dato: 'pg/jsonb@1' })
        .build(),
    );
    return rows.map((row) => row.dato);
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
    const [row] = await this.prisma.db.query(
      this.prisma.db.raw.sql`
      WITH snapshots AS (
        SELECT DISTINCT ON(producto) * FROM indicadores_instantaneas WHERE publicada=true AND (${producto ?? ''}::text = '' OR producto=${producto ?? ''}) AND (${instantaneaId ?? ''}::text = '' OR id=${instantaneaId ?? ''}) ORDER BY producto,creado_en DESC,id DESC
      ), datos AS (
        SELECT i.*
        FROM indicadores_externos i JOIN snapshots s ON s.id=i.instantanea_id WHERE (${ambito ?? ''}::text = '' OR i.ambito=${ambito ?? ''}) AND (${entidad ?? ''}::text = '' OR i.entidad=${entidad ?? ''}) AND (${granularidad ?? ''}::text = '' OR i.granularidad=${granularidad ?? ''}) AND (${mes ?? ''}::text = '' OR to_char(i.hasta,'YYYY-MM')=${mes ?? ''})
      ), pagina AS (
        SELECT * FROM datos ORDER BY hasta DESC,ambito,entidad,granularidad,instantanea_id LIMIT ${query.limite} OFFSET ${(query.pagina - 1) * query.limite}
      ) SELECT jsonb_build_object('total',(SELECT count(*) FROM datos),'datos',COALESCE((
        SELECT jsonb_agg(jsonb_build_object('instantaneaId',s.id,'producto',s.producto,'fuente','EUROCONTROL','atribucion',s.atribucion,'aviso',s.aviso,'metodologia',s.metodologia,'uri',s.uri,'actualizadoEn',s.creado_en,'ambito',i.ambito,'entidad',i.entidad,'nombre',i.nombre,'granularidad',i.granularidad,'desde',i.desde,'hasta',i.hasta,'valores',i.valores)
          ORDER BY i.hasta DESC,i.ambito,i.entidad,i.granularidad,i.instantanea_id)
        FROM pagina i JOIN snapshots s ON s.id=i.instantanea_id
      ),'[]'::jsonb)) AS resultado
    `
        .returnsRow({ resultado: 'pg/jsonb@1' })
        .build(),
    );
    return row.resultado;
  }
  async snapshots(query: ConsultaIndicadoresDto) {
    const [row] = await this.prisma.db.query(
      this.prisma.db.raw.sql`
        WITH publicadas AS (
          SELECT id,producto,creado_en,checksum,ejecucion_id FROM indicadores_instantaneas
          WHERE publicada=true AND (${query.producto ?? ''}='' OR producto=${query.producto ?? ''})
        ), pagina AS (
          SELECT * FROM publicadas ORDER BY creado_en DESC,id DESC LIMIT ${query.limite} OFFSET ${(query.pagina - 1) * query.limite}
        ) SELECT jsonb_build_object('total',(SELECT count(*) FROM publicadas),'datos',COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id',id,'producto',producto,'actualizadoEn',creado_en,'checksum',checksum,'ejecucionId',ejecucion_id)
            ORDER BY creado_en DESC,id DESC) FROM pagina
        ),'[]'::jsonb)) AS resultado
      `
        .returnsRow({ resultado: 'pg/jsonb@1' })
        .build(),
    );
    return row.resultado;
  }
}
