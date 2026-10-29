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
import { pipeline } from 'node:stream/promises';
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
import { OPENFLIGHTS_COLUMNS } from './catalog.js';
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
      ['countries', 'airports', 'airlines', 'routes'] as const
    ).map((dataset, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      name: `OpenFlights: ${dataset}`,
      datasetName: dataset,
      description:
        'Catálogo OpenFlights; rutas históricas, sin información OTP.',
      targetEntity: dataset,
      isSystem: true,
      paused: false,
      connection: {
        sourceType: 'http_stream',
        endpointUrl: `https://raw.githubusercontent.com/jpatokal/openflights/master/data/${dataset}.dat`,
        httpMethod: 'GET',
        dataFormat: 'csv',
        csvHasHeader: false,
        csvDelimiter: ',',
      },
      schemaMapping: OPENFLIGHTS_COLUMNS[dataset].flatMap(
        (targetField, position) =>
          targetField.startsWith('_')
            ? []
            : [{ sourceColumn: String(position), targetField }],
      ),
      scheduleConfig: {
        cronExpression: '',
        batchSize: 2000,
        timeoutSeconds: 300,
        maxRetries: 2,
      },
    }));
    await this.prisma.models.EtlPipeline.createAndCount(defaults, {
      onConflict: 'skip',
    });
    // Reconcile schedulers after a crash between the database write and Redis update.
    for await (const row of this.prisma.models.EtlPipeline.limit(1000).all()) {
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
    return this.prisma.models.EtlPipeline.where({ archivedAt: null })
      .orderBy((p) => p.createdAt.desc())
      .limit(1000)
      .all();
  }

  private async find(id: string) {
    const row = await this.prisma.models.EtlPipeline.where({
      id,
      archivedAt: null,
    }).first();
    if (!row) throw new NotFoundException('Pipeline no encontrado');
    return row;
  }

  async validateConfiguration(source: string, configuration: unknown) {
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
      { ...configuration, targetEntity: source },
      { type: 'body', metatype: PipelineExecutionDto },
    )) as PipelineExecutionDto;
    this.validate(dto);
    return {
      connection: dto.connection,
      schemaMapping: dto.schemaMapping,
      scheduleConfig: dto.scheduleConfig,
    };
  }

  private validate(dto: PipelineExecutionDto) {
    validateSourceUrl(dto.connection.endpointUrl);
    sourceHeaders(dto.connection);
    const fields = dto.schemaMapping.map((rule) => rule.targetField);
    if (
      new Set(fields).size !== fields.length ||
      fields.some((field) => !CATALOG_FIELDS[dto.targetEntity].includes(field))
    )
      throw new BadRequestException(
        'Mapeo duplicado o campo de destino desconocido',
      );
    const required: Record<CatalogTarget, string[]> = {
      countries: ['name'],
      airports: ['openflightsId', 'name', 'latitude', 'longitude'],
      airlines: ['openflightsId', 'name'],
      routes: ['stops'],
    };
    if (required[dto.targetEntity].some((field) => !fields.includes(field)))
      throw new BadRequestException(
        'El mapeo no cubre los campos obligatorios del destino',
      );
    if (
      dto.targetEntity === 'routes' &&
      (!fields.some((f) => ['originCode', 'originOpenflightsId'].includes(f)) ||
        !fields.some((f) =>
          ['destinationCode', 'destinationOpenflightsId'].includes(f),
        ))
    )
      throw new BadRequestException(
        'El mapeo debe identificar origen y destino',
      );
    if (dto.scheduleConfig.cronExpression) {
      try {
        defaultRepeatStrategy(Date.now(), {
          pattern: dto.scheduleConfig.cronExpression,
          tz: 'UTC',
        });
      } catch {
        throw new BadRequestException('Expresión cron inválida');
      }
    }
  }

  private async schedule(row: {
    id: string;
    paused: boolean;
    archivedAt: string | null;
    scheduleConfig: unknown;
    targetEntity: string;
    connection: unknown;
    schemaMapping: unknown;
  }) {
    if (row.paused || row.archivedAt) {
      await this.queue.removeJobScheduler(row.id);
      return;
    }
    const { scheduleConfig: config } = await this.validateConfiguration(
      row.targetEntity,
      {
        connection: row.connection,
        schemaMapping: row.schemaMapping,
        scheduleConfig: row.scheduleConfig,
      },
    );
    if (!config.cronExpression) {
      await this.queue.removeJobScheduler(row.id);
    } else {
      await this.queue.upsertJobScheduler(
        row.id,
        { pattern: config.cronExpression, tz: 'UTC' },
        { name: 'scheduled-pipeline', data: { pipelineId: row.id } },
      );
    }
  }

  async create(dto: CreatePipelineDto) {
    this.validate(dto);
    const row = await this.prisma.models.EtlPipeline.create({
      ...dto,
      description: dto.description ?? '',
      connection: {
        ...dto.connection,
        headers: dto.connection.headers?.map((h) => ({ ...h })) ?? [],
      },
      schemaMapping: dto.schemaMapping.map((r) => ({ ...r })),
      scheduleConfig: { ...dto.scheduleConfig },
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
        name: row.name,
        datasetName: row.datasetName,
        description: row.description,
        targetEntity: row.targetEntity,
        paused: row.paused,
        connection: row.connection,
        schemaMapping: row.schemaMapping,
        scheduleConfig: row.scheduleConfig,
        ...patch,
      },
      { type: 'body', metatype: CreatePipelineDto },
    )) as CreatePipelineDto;
    this.validate(dto);
    const saved = await this.prisma.models.EtlPipeline.where({ id }).update({
      ...dto,
      connection: {
        ...dto.connection,
        headers: dto.connection.headers?.map((h) => ({ ...h })) ?? [],
      },
      schemaMapping: dto.schemaMapping.map((r) => ({ ...r })),
      scheduleConfig: { ...dto.scheduleConfig },
    });
    if (!saved) throw new NotFoundException('Pipeline no encontrado');
    await this.schedule(saved);
    return saved;
  }

  async archive(id: string) {
    const row = await this.find(id);
    if (row.isSystem)
      throw new BadRequestException(
        'Los pipelines de sistema no pueden archivarse',
      );
    const saved = await this.prisma.models.EtlPipeline.where({ id }).update({
      archivedAt: now(),
      paused: true,
    });
    if (!saved) throw new NotFoundException('Pipeline no encontrado');
    await this.schedule(saved);
    return saved;
  }

  async run(id: string, requestedById?: string, scheduled = false) {
    const row = await this.find(id);
    if (row.paused) {
      if (scheduled) return null;
      throw new ConflictException('Pipeline pausado');
    }
    const configuration = {
      connection: row.connection,
      schemaMapping: row.schemaMapping,
      scheduleConfig: row.scheduleConfig,
    } as PipelineConfiguration;
    return this.enqueue(row.targetEntity, configuration, row.id, requestedById);
  }

  private async enqueue(
    source: string,
    configuration: PipelineConfiguration,
    pipelineId?: string,
    requestedById?: string,
  ) {
    configuration = await this.validateConfiguration(source, configuration);
    const record = await this.prisma.models.EtlJob.create({
      source,
      status: 'pending',
      pipelineId: pipelineId ?? null,
      requestedById: requestedById ?? null,
      configurationSnapshot: configuration,
      sourceUri: configuration.connection.endpointUrl,
    });
    try {
      await this.queue.add(
        'process-dataset',
        { jobId: record.id, dataset: source },
        {
          jobId: record.id,
          attempts: configuration.scheduleConfig.maxRetries + 1,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      );
    } catch {
      await this.prisma.models.EtlJob.where({ id: record.id }).update({
        status: 'failed',
        errorMessage: 'No fue posible encolar la ejecución',
      });
      throw new BadRequestException('No fue posible encolar la ejecución');
    }
    return { jobId: record.id };
  }

  async job(id: string) {
    const row = await this.prisma.models.EtlJob.where({ id }).first();
    if (!row) throw new NotFoundException('Ejecución no encontrada');
    return row;
  }
  async events(id: string) {
    await this.job(id);
    const rows = await this.prisma.models.EtlJobEvent.where({ jobId: id })
      .orderBy((e) => e.createdAt.desc())
      .limit(100)
      .all();
    return rows.map((row) => ({
      ...row,
      createdAt: timestampToDate(row.createdAt).toISOString(),
    }));
  }
  async samples(id: string, attempt?: number) {
    const job = await this.job(id);
    const rows = await this.prisma.models.EtlDiscardedSample.where({
      jobId: id,
      attempt: attempt ?? job.attempt,
    })
      .orderBy((s) => s.rowIndex.asc())
      .limit(100)
      .all();
    return rows.map((row) => ({
      ...row,
      createdAt: timestampToDate(row.createdAt).toISOString(),
    }));
  }
  async retry(id: string, requestedById: string) {
    const job = await this.job(id);
    if (job.status !== 'failed' && job.status !== 'completed')
      throw new ConflictException('La ejecución todavía está activa');
    if (!job.configurationSnapshot) {
      const record = await this.prisma.models.EtlJob.create({
        source: job.source,
        status: 'pending',
        requestedById,
      });
      try {
        await this.queue.add(
          'process-dataset',
          { jobId: record.id, dataset: job.source },
          {
            jobId: record.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        );
      } catch {
        await this.prisma.models.EtlJob.where({ id: record.id }).update({
          status: 'failed',
          errorMessage: 'No fue posible encolar la ejecución',
        });
        throw new BadRequestException('No fue posible encolar la ejecución');
      }
      return { jobId: record.id };
    }
    return this.enqueue(
      job.source,
      job.configurationSnapshot as PipelineConfiguration,
      job.pipelineId ?? undefined,
      requestedById,
    );
  }

  async probe(connection: PipelineConnectionDto) {
    const start = performance.now();
    let statusCode = 0,
      contentType = '';
    try {
      const source = await openCsvSource(connection, 30);
      statusCode = source.statusCode ?? 0;
      contentType = String(source.headers['content-type'] ?? '');
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
        await pipeline(
          source,
          limit,
          csv({
            headers: connection.csvHasHeader ? undefined : false,
            separator: connection.csvDelimiter ?? ',',
            maxRowBytes: 1024 * 1024,
          }),
          async (rows: AsyncIterable<Record<string, string>>) => {
            for await (const row of rows) {
              sampleRows.push(redactSourceRow(row, connection));
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
        errorMessage:
          error instanceof BadRequestException
            ? error.message
            : 'No fue posible leer una muestra CSV válida de la fuente autorizada',
      };
    }
  }
}
