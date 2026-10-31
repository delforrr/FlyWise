import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, defaultRepeatStrategy } from 'bullmq';
import { Transform } from 'node:stream';
import { pipeline as proceso } from 'node:stream/promises';
import csv from 'csv-parser';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CATALOG_FIELDS,
  CreatePipelineDto,
  PipelineConnectionDto,
  PipelineExecutionDto,
  type CatalogTarget,
  type UpdatePipelineDto,
} from './dto/pipeline.dto.js';
import {
  openCsvSource,
  redactSourceRow,
  sourceHeaders,
  validateSourceUrl,
} from './http-source.js';
import { timestampToDate } from '../prisma/timestamp.js';
import { OPENFLIGHTS_COLUMNS, OPENFLIGHTS_FILES } from './catalog.js';
import type { PipelineConfiguration } from './interfaces/pipeline-configuration.js';

const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '');

@Injectable()
export class PipelinesService implements OnModuleInit {
  private readonly logger = new Logger(PipelinesService.name);
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('etl-queue') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.setGlobalConcurrency(1);
    const defaults = (
      ['paises', 'aeropuertos', 'aerolineas', 'rutas'] as const
    ).map((dataset, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      nombre: `OpenFlights: ${dataset}`,
      nombreConjunto: dataset,
      descripcion:
        'Catálogo OpenFlights; rutas históricas, sin información OTP.',
      entidadDestino: dataset,
      esSistema: true,
      pausado: false,
      conexion: {
        tipoFuente: 'http_stream',
        urlEndpoint: `https://raw.githubusercontent.com/jpatokal/openflights/master/data/${OPENFLIGHTS_FILES[dataset]}`,
        metodoHttp: 'GET',
        formatoDatos: 'csv',
        csvConCabecera: false,
        separadorCsv: ',',
      },
      mapeoEsquema: OPENFLIGHTS_COLUMNS[dataset].flatMap(
        (campoDestino, position) =>
          campoDestino.startsWith('_')
            ? []
            : [{ columnaOrigen: String(position), campoDestino }],
      ),
      configuracionProgramacion: {
        expresionCron: '',
        tamanoLote: 2000,
        tiempoLimiteSegundos: 300,
        maximoReintentos: 2,
      },
    }));
    await this.prisma.models.ProcesoEtl.createAndCount(defaults, {
      onConflict: 'skip',
    });
    // Reconcile schedulers after a crash between the database write and Redis update.
    for await (const row of this.prisma.models.ProcesoEtl.limit(1000).all()) {
      try {
        await this.schedule(row);
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        await this.queue.removeJobScheduler(row.id);
        this.logger.warn(
          `Pipeline ${row.id}: configuración inválida; programación deshabilitada`,
        );
      }
    }
  }

  list() {
    return this.prisma.models.ProcesoEtl.where({ archivadoEn: null })
      .orderBy((p) => p.creadoEn.desc())
      .limit(1000)
      .all();
  }

  private async find(id: string) {
    const row = await this.prisma.models.ProcesoEtl.where({
      id,
      archivadoEn: null,
    }).first();
    if (!row) throw new NotFoundException('Pipeline no encontrado');
    return row;
  }

  async validateConfiguration(fuente: string, configuration: unknown) {
    if (
      !configuration ||
      typeof configuration !== 'object' ||
      Array.isArray(configuration)
    )
      throw new BadRequestException('Configuración de ejecución inválida');
    const dto = (await new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }).transform(
      { ...configuration, entidadDestino: fuente },
      { type: 'body', metatype: PipelineExecutionDto },
    )) as PipelineExecutionDto;
    this.validate(dto);
    return {
      conexion: dto.conexion,
      mapeoEsquema: dto.mapeoEsquema,
      configuracionProgramacion: dto.configuracionProgramacion,
    };
  }

  private validate(dto: PipelineExecutionDto) {
    validateSourceUrl(dto.conexion.urlEndpoint);
    sourceHeaders(dto.conexion);
    const fields = dto.mapeoEsquema.map((rule) => rule.campoDestino);
    if (
      new Set(fields).size !== fields.length ||
      fields.some(
        (campo) => !CATALOG_FIELDS[dto.entidadDestino].includes(campo),
      )
    )
      throw new BadRequestException(
        'Mapeo duplicado o campo de destino desconocido',
      );
    const required: Record<CatalogTarget, string[]> = {
      paises: ['nombre'],
      aeropuertos: ['idOpenflights', 'nombre', 'latitud', 'longitud'],
      aerolineas: ['idOpenflights', 'nombre'],
      rutas: ['escalas'],
    };
    if (required[dto.entidadDestino].some((campo) => !fields.includes(campo)))
      throw new BadRequestException(
        'El mapeo no cubre los campos obligatorios del destino',
      );
    if (
      dto.entidadDestino === 'rutas' &&
      (!fields.some((f) =>
        ['codigoOrigen', 'idOpenflightsOrigen'].includes(f),
      ) ||
        !fields.some((f) =>
          ['codigoDestino', 'idOpenflightsDestino'].includes(f),
        ))
    )
      throw new BadRequestException(
        'El mapeo debe identificar origen y destino',
      );
    if (dto.configuracionProgramacion.expresionCron) {
      try {
        defaultRepeatStrategy(Date.now(), {
          pattern: dto.configuracionProgramacion.expresionCron,
          tz: 'UTC',
        });
      } catch {
        throw new BadRequestException('Expresión cron inválida');
      }
    }
  }

  private async schedule(row: {
    id: string;
    pausado: boolean;
    archivadoEn: string | null;
    configuracionProgramacion: unknown;
    entidadDestino: string;
    conexion: unknown;
    mapeoEsquema: unknown;
  }) {
    if (row.pausado || row.archivadoEn) {
      await this.queue.removeJobScheduler(row.id);
      return;
    }
    const { configuracionProgramacion: config } =
      await this.validateConfiguration(row.entidadDestino, {
        conexion: row.conexion,
        mapeoEsquema: row.mapeoEsquema,
        configuracionProgramacion: row.configuracionProgramacion,
      });
    if (!config.expresionCron) {
      await this.queue.removeJobScheduler(row.id);
    } else {
      await this.queue.upsertJobScheduler(
        row.id,
        { pattern: config.expresionCron, tz: 'UTC' },
        { name: 'scheduled-pipeline', data: { pipelineId: row.id } },
      );
    }
  }

  async create(dto: CreatePipelineDto) {
    this.validate(dto);
    const row = await this.prisma.models.ProcesoEtl.create({
      ...dto,
      descripcion: dto.descripcion ?? '',
      conexion: {
        ...dto.conexion,
        headers: dto.conexion.headers?.map((h) => ({ ...h })) ?? [],
      },
      mapeoEsquema: dto.mapeoEsquema.map((r) => ({ ...r })),
      configuracionProgramacion: { ...dto.configuracionProgramacion },
    });
    await this.schedule(row);
    return row;
  }

  async update(id: string, patch: UpdatePipelineDto) {
    const row = await this.find(id);
    const dto = (await new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }).transform(
      {
        nombre: row.nombre,
        nombreConjunto: row.nombreConjunto,
        descripcion: row.descripcion,
        entidadDestino: row.entidadDestino,
        pausado: row.pausado,
        conexion: row.conexion,
        mapeoEsquema: row.mapeoEsquema,
        configuracionProgramacion: row.configuracionProgramacion,
        ...patch,
      },
      { type: 'body', metatype: CreatePipelineDto },
    )) as CreatePipelineDto;
    this.validate(dto);
    const saved = await this.prisma.models.ProcesoEtl.where({ id }).update({
      ...dto,
      conexion: {
        ...dto.conexion,
        headers: dto.conexion.headers?.map((h) => ({ ...h })) ?? [],
      },
      mapeoEsquema: dto.mapeoEsquema.map((r) => ({ ...r })),
      configuracionProgramacion: { ...dto.configuracionProgramacion },
    });
    if (!saved) throw new NotFoundException('Pipeline no encontrado');
    await this.schedule(saved);
    return saved;
  }

  async archive(id: string) {
    const row = await this.find(id);
    if (row.esSistema)
      throw new BadRequestException(
        'Los pipelines de sistema no pueden archivarse',
      );
    const saved = await this.prisma.models.ProcesoEtl.where({ id }).update({
      archivadoEn: now(),
      pausado: true,
    });
    if (!saved) throw new NotFoundException('Pipeline no encontrado');
    await this.schedule(saved);
    return saved;
  }

  async run(id: string, solicitanteId?: string, scheduled = false) {
    const row = await this.find(id);
    if (row.pausado) {
      if (scheduled) return null;
      throw new ConflictException('Pipeline pausado');
    }
    const configuration = {
      conexion: row.conexion,
      mapeoEsquema: row.mapeoEsquema,
      configuracionProgramacion: row.configuracionProgramacion,
    } as PipelineConfiguration;
    return this.enqueue(
      row.entidadDestino,
      configuration,
      row.id,
      solicitanteId,
    );
  }

  private async enqueue(
    fuente: string,
    configuration: PipelineConfiguration,
    procesoId?: string,
    solicitanteId?: string,
  ) {
    configuration = await this.validateConfiguration(fuente, configuration);
    const record = await this.prisma.models.EjecucionEtl.create({
      fuente,
      estado: 'pending',
      procesoId: procesoId ?? null,
      solicitanteId: solicitanteId ?? null,
      instantaneaConfiguracion: configuration,
      uriFuente: configuration.conexion.urlEndpoint,
    });
    try {
      await this.queue.add(
        'process-dataset',
        { jobId: record.id, dataset: fuente },
        {
          jobId: record.id,
          attempts:
            configuration.configuracionProgramacion.maximoReintentos + 1,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      );
    } catch {
      await this.prisma.models.EjecucionEtl.where({ id: record.id }).update({
        estado: 'failed',
        mensajeError: 'No fue posible encolar la ejecución',
      });
      throw new BadRequestException('No fue posible encolar la ejecución');
    }
    return { ejecucionId: record.id };
  }

  async job(id: string) {
    const row = await this.prisma.models.EjecucionEtl.where({ id }).first();
    if (!row) throw new NotFoundException('Ejecución no encontrada');
    return row;
  }
  async eventos(id: string) {
    await this.job(id);
    const rows = await this.prisma.models.EventoEjecucionEtl.where({
      ejecucionId: id,
    })
      .orderBy((e) => e.creadoEn.desc())
      .limit(100)
      .all();
    return rows.map((row) => ({
      ...row,
      creadoEn: timestampToDate(row.creadoEn).toISOString(),
    }));
  }
  async samples(id: string, intento?: number) {
    const job = await this.job(id);
    const rows = await this.prisma.models.MuestraDescartadaEtl.where({
      ejecucionId: id,
      intento: intento ?? job.intento,
    })
      .orderBy((s) => s.numeroFila.asc())
      .limit(100)
      .all();
    return rows.map((row) => ({
      ...row,
      creadoEn: timestampToDate(row.creadoEn).toISOString(),
    }));
  }
  async retry(id: string, solicitanteId: string) {
    const job = await this.job(id);
    if (job.estado !== 'failed' && job.estado !== 'completed')
      throw new ConflictException('La ejecución todavía está activa');
    if (!job.instantaneaConfiguracion) {
      const record = await this.prisma.models.EjecucionEtl.create({
        fuente: job.fuente,
        estado: 'pending',
        solicitanteId,
      });
      try {
        await this.queue.add(
          'process-dataset',
          { jobId: record.id, dataset: job.fuente },
          {
            jobId: record.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        );
      } catch {
        await this.prisma.models.EjecucionEtl.where({ id: record.id }).update({
          estado: 'failed',
          mensajeError: 'No fue posible encolar la ejecución',
        });
        throw new BadRequestException('No fue posible encolar la ejecución');
      }
      return { ejecucionId: record.id };
    }
    return this.enqueue(
      job.fuente,
      job.instantaneaConfiguracion as PipelineConfiguration,
      job.procesoId ?? undefined,
      solicitanteId,
    );
  }

  async probe(conexion: PipelineConnectionDto) {
    const start = performance.now();
    let statusCode = 0,
      contentType = '';
    try {
      const fuente = await openCsvSource(conexion, 30);
      statusCode = fuente.statusCode ?? 0;
      contentType = String(fuente.headers['content-type'] ?? '');
      let bytes = 0;
      const sampleRows: Record<string, string>[] = [];
      const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          callback(
            bytes > 1024 * 1024 ? new Error('probe limit') : null,
            chunk,
          );
        },
      });
      try {
        await proceso(
          fuente,
          limit,
          csv({
            headers: conexion.csvConCabecera ? undefined : false,
            separator: conexion.separadorCsv ?? ',',
            maxRowBytes: 1024 * 1024,
          }),
          async (rows: AsyncIterable<Record<string, string>>) => {
            for await (const row of rows) {
              sampleRows.push(redactSourceRow(row, conexion));
              if (sampleRows.length === 5) break;
            }
          },
        );
      } catch (error) {
        if (sampleRows.length !== 5) throw error;
      }
      return {
        success: true,
        statusCode,
        latencyMs: Math.round(performance.now() - start),
        contentType,
        sampleRows,
        detectedColumns: Object.keys(sampleRows[0] ?? {}),
      };
    } catch (error) {
      return {
        success: false,
        statusCode,
        latencyMs: Math.round(performance.now() - start),
        contentType,
        sampleRows: [],
        detectedColumns: [],
        mensajeError:
          error instanceof BadRequestException
            ? error.message
            : 'No fue posible leer una muestra CSV válida de la fuente autorizada',
      };
    }
  }
}
