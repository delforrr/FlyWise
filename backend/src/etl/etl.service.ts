import { timestampToDate } from '../prisma/timestamp.js';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'node:fs';
import csv from 'csv-parser';
import { pipeline } from 'node:stream/promises';
import { ETL_DATASETS } from './dto/trigger-etl.dto.js';
import { createHash } from 'node:crypto';
import {
  catalogValue,
  normalizeCatalogRow,
  OPENFLIGHTS_COLUMNS,
  type CatalogDataset,
  type CatalogRecord,
} from './catalog.js';
import { upsertCatalogBatch, resolveRouteBatch } from './catalog-store.js';
import { openCsvSource, redactSourceRow } from './http-source.js';
import {
  MAX_DISCARDED_SAMPLES_PER_JOB,
  type PipelineConfiguration,
} from './interfaces/pipeline-configuration.js';
import { linkCatalogCountries } from '../prisma/link-catalog-countries.js';

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  constructor(
    @InjectQueue('etl-queue') private readonly etlQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async triggerJob(dataset: string) {
    if (!ETL_DATASETS.includes(dataset)) {
      throw new BadRequestException('Dataset no soportado');
    }
    const jobRecord = await this.prisma.models.EtlJob.create({
      source: dataset,
      status: 'pending',
    });

    try {
      const job = await this.etlQueue.add(
        'process-dataset',
        { jobId: jobRecord.id, dataset },
        {
          jobId: jobRecord.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      );
      return {
        message: `Job ${dataset} encolado exitosamente`,
        jobId: jobRecord.id,
        bullJobId: job.id,
      };
    } catch (error) {
      await this.prisma.models.EtlJob.where({ id: jobRecord.id }).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.etlQueue.getWaitingCount(),
      this.etlQueue.getActiveCount(),
      this.etlQueue.getCompletedCount(),
      this.etlQueue.getFailedCount(),
    ]);

    return {
      queue: 'etl-queue',
      counts: {
        waiting,
        active,
        completed,
        failed,
      },
    };
  }

  async getHistory() {
    const jobs = await this.prisma.models.EtlJob.orderBy((job) =>
      job.startedAt.desc(),
    )
      .limit(20)
      .all();
    return jobs.map((job) => {
      const startedAt = job.startedAt ? timestampToDate(job.startedAt) : null;
      const finishedAt = job.finishedAt
        ? timestampToDate(job.finishedAt)
        : null;
      return {
        ...job,
        startedAt,
        finishedAt,
        durationMs:
          startedAt && finishedAt
            ? finishedAt.getTime() - startedAt.getTime()
            : null,
      };
    });
  }

  processCountries(filePath: string, jobId?: string) {
    return this.importCatalog('countries', filePath, jobId);
  }
  processAirports(filePath: string, jobId?: string) {
    return this.importCatalog('airports', filePath, jobId);
  }
  processAirlines(filePath: string, jobId?: string) {
    return this.importCatalog('airlines', filePath, jobId);
  }
  processRoutes(filePath: string, jobId?: string) {
    return this.importCatalog('routes', filePath, jobId);
  }

  async importCatalog(
    dataset: CatalogDataset,
    filePath: string | null,
    jobId?: string,
    configuration?: PipelineConfiguration,
  ) {
    const source = filePath
      ? fs.createReadStream(filePath)
      : await openCsvSource(
          configuration!.connection,
          configuration!.scheduleConfig.timeoutSeconds,
        );
    const checksum = createHash('sha256');
    const headers = configuration?.connection.csvHasHeader ? undefined : false;
    const batchSize = configuration?.scheduleConfig.batchSize ?? 2000;
    let total = 0,
      inserted = 0,
      discarded = 0;
    let batch: { row: CatalogRecord; rowIndex: number; sample: string }[] = [];
    let samples: {
      attempt: number;
      rowIndex: number;
      field: string | null;
      reason: string;
      rawSample: string;
    }[] = [];
    let sampleCount = 0;
    let normalizedCodes = 0;
    const before = jobId
      ? await this.prisma.models.EtlJob.where({ id: jobId }).firstOrThrow()
      : null;
    const base = {
      total: before?.totalRows ?? 0,
      processed: before?.processedRows ?? 0,
      inserted: before?.insertedRows ?? 0,
      discarded: before?.discardedRows ?? 0,
    };
    const recordDiscard = (
      rowIndex: number,
      reason: string,
      sample: string,
    ) => {
      discarded++;
      if (sampleCount < MAX_DISCARDED_SAMPLES_PER_JOB) {
        samples.push({
          attempt: before?.attempt ?? 0,
          rowIndex: base.total + rowIndex,
          field: reason.includes(':') ? reason.split(':')[0] : null,
          reason,
          rawSample: sample.slice(0, 4096),
        });
        sampleCount++;
      }
    };
    if (jobId) {
      const count = await this.prisma.models.EtlDiscardedSample.where({
        jobId,
        attempt: before?.attempt ?? 0,
      }).aggregate((a) => ({ count: a.count() }));
      sampleCount = Number(count.count);
    }
    const flush = async () => {
      await this.prisma.db.transaction(async (tx) => {
        let rows = batch.map(({ row }) => row);
        if (dataset === 'routes' && rows.length) {
          const resolved = await resolveRouteBatch(tx, rows);
          rows = batch.flatMap((entry, index) => {
            const refs = resolved[index];
            if (
              !refs?.originId ||
              !refs.destinationId ||
              refs.originId === refs.destinationId
            ) {
              recordDiscard(
                entry.rowIndex,
                'endpoints: ausentes, ambiguos o iguales',
                entry.sample,
              );
              return [];
            }
            return [
              {
                ...entry.row,
                originId: refs.originId,
                destinationId: refs.destinationId,
                airlineId: refs.airlineId,
              },
            ];
          });
        }
        if (rows.length)
          inserted += await upsertCatalogBatch(tx, dataset, rows);
        if (jobId) {
          if (samples.length)
            await tx.orm.public.EtlDiscardedSample.createAndCount(
              samples.map((sample) => ({ ...sample, jobId })),
            );
          await tx.orm.public.EtlJob.where({ id: jobId }).update({
            totalRows: base.total + total,
            processedRows: base.processed + total - discarded,
            insertedRows: base.inserted + inserted,
            discardedRows: base.discarded + discarded,
          });
        }
      });
      batch = [];
      samples = [];
    };
    await pipeline(
      source,
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          checksum.update(chunk);
          yield chunk;
        }
      },
      csv({
        headers,
        separator: configuration?.connection.csvDelimiter ?? ',',
        maxRowBytes: 1024 * 1024,
        strict: Boolean(headers === undefined),
      }),
      async (rows: AsyncIterable<Record<string, string>>) => {
        for await (const raw of rows) {
          if (
            total === 0 &&
            configuration &&
            configuration.schemaMapping.some(
              (rule) => !(rule.sourceColumn in raw),
            )
          )
            throw new Error('El mapeo referencia columnas que no existen');
          total++;
          const safe = configuration
            ? redactSourceRow(raw, configuration.connection)
            : raw;
          const sample = JSON.stringify(safe).slice(0, 4096);
          try {
            let mapped: Record<string, unknown> = {};
            if (configuration) {
              for (const rule of configuration.schemaMapping) {
                let value: string | number | boolean | null | undefined =
                  raw[rule.sourceColumn];
                if (rule.transform === 'uppercase')
                  value = String(value ?? '').toUpperCase();
                if (rule.transform === 'trim')
                  value = String(value ?? '').trim();
                if (rule.transform === 'to_number')
                  value =
                    value == null ||
                    String(value).trim() === '' ||
                    value === String.raw`\N`
                      ? null
                      : Number(value);
                if (rule.transform === 'to_boolean') {
                  const text = String(value ?? '')
                    .trim()
                    .toUpperCase();
                  if (
                    text &&
                    text !== String.raw`\N` &&
                    !['Y', 'N', 'TRUE', 'FALSE', '1', '0'].includes(text)
                  )
                    throw new Error(`${rule.targetField}: booleano invalido`);
                  value =
                    !text || text === String.raw`\N`
                      ? null
                      : ['Y', 'TRUE', '1'].includes(text);
                }
                if (rule.required && catalogValue(value) === null)
                  throw new Error(`${rule.targetField}: obligatorio`);
                mapped[rule.targetField] = value;
              }
            } else {
              const columns = OPENFLIGHTS_COLUMNS[dataset];
              if (Object.keys(raw).length !== columns.length)
                throw new Error('columns: cantidad incorrecta');
              mapped = Object.fromEntries(
                columns.map((field, index) => [field, raw[String(index)]]),
              );
            }
            const normalized = normalizeCatalogRow(dataset, mapped);
            for (const rule of configuration?.schemaMapping ?? []) {
              if (rule.required && normalized[rule.targetField] === null)
                throw new Error(`${rule.targetField}: obligatorio o inválido`);
            }
            for (const field of [
              'iata',
              'icao',
              'isoCode',
              'originCode',
              'destinationCode',
              'airlineCode',
            ]) {
              const original = catalogValue(mapped[field]);
              if (
                original &&
                !['-', 'N/A'].includes(original.toUpperCase()) &&
                normalized[field] === null
              ) {
                normalizedCodes++;
                normalized[`${field}Invalid`] = true;
              }
            }
            batch.push({
              row: normalized,
              rowIndex: total,
              sample,
            });
          } catch (error) {
            recordDiscard(
              total,
              error instanceof Error ? error.message : 'row: invalida',
              sample,
            );
          }
          if (total % batchSize === 0) await flush();
        }
        if (batch.length || samples.length || total % batchSize !== 0)
          await flush();
      },
    );
    if (total > discarded && dataset !== 'routes')
      await linkCatalogCountries(this.prisma.db);
    if (dataset === 'routes') await this.computeRouteCounts();
    if (normalizedCodes && jobId)
      await this.prisma.models.EtlJobEvent.create({
        jobId,
        attempt: before?.attempt ?? 0,
        level: 'warn',
        message: `${dataset}: ${normalizedCodes} códigos opcionales inválidos normalizados a NULL`,
      });
    if (jobId && configuration)
      await this.prisma.models.EtlJob.where({ id: jobId }).update({
        sourceChecksum: checksum.digest('hex'),
      });
    this.logger.log(
      `${dataset}: ${total} leidas, ${total - discarded} procesadas, ${inserted} nuevas, ${discarded} descartadas`,
    );
    return { total, processed: total - discarded, inserted, discarded };
  }

  async computeRouteCounts() {
    await this.prisma.db.execute(
      this.prisma.db.raw.sql`
      WITH counts AS (
        SELECT airport_id, count(*)::int AS count FROM (
          SELECT origin_id AS airport_id FROM routes UNION ALL SELECT destination_id FROM routes
        ) endpoints GROUP BY airport_id
      )
      UPDATE airports a SET route_count=COALESCE(c.count,0)
      FROM (SELECT a2.id, counts.count FROM airports a2 LEFT JOIN counts ON counts.airport_id=a2.id) c
      WHERE a.id=c.id
    `
        .affectedCount()
        .build(),
    );
  }
}
