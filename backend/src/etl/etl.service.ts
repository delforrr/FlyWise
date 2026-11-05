import {
  bloquearCatalogo,
  recalcularCantidadRutas,
} from '../prisma/catalog-state.js';
import { timestampToDate } from '../prisma/timestamp.js';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'node:fs';
import csv from 'csv-parser';
import { pipeline as proceso } from 'node:stream/promises';
import { ETL_DATASETS } from './dto/trigger-etl.dto.js';
import { createHash } from 'node:crypto';
import {
  catalogValue,
  claveRutaFuente,
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
    const jobRecord = await this.prisma.models.EjecucionEtl.create({
      fuente: dataset,
      estado: 'pending',
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
        ejecucionId: jobRecord.id,
        bullJobId: job.id,
      };
    } catch (error) {
      await this.prisma.models.EjecucionEtl.where({ id: jobRecord.id }).update({
        estado: 'failed',
        mensajeError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getStatus() {
    const [waiting, activa, completed, failed] = await Promise.all([
      this.etlQueue.getWaitingCount(),
      this.etlQueue.getActiveCount(),
      this.etlQueue.getCompletedCount(),
      this.etlQueue.getFailedCount(),
    ]);

    return {
      queue: 'etl-queue',
      counts: {
        waiting,
        activa,
        completed,
        failed,
      },
    };
  }

  async getHistory() {
    const ejecuciones = await this.prisma.models.EjecucionEtl.orderBy((job) =>
      job.iniciadoEn.desc(),
    )
      .limit(20)
      .all();
    return ejecuciones.map((job) => {
      const iniciadoEn = job.iniciadoEn
        ? timestampToDate(job.iniciadoEn)
        : null;
      const finalizadoEn = job.finalizadoEn
        ? timestampToDate(job.finalizadoEn)
        : null;
      return {
        ...job,
        iniciadoEn,
        finalizadoEn,
        durationMs:
          iniciadoEn && finalizadoEn
            ? finalizadoEn.getTime() - iniciadoEn.getTime()
            : null,
      };
    });
  }

  processCountries(filePath: string, ejecucionId?: string) {
    return this.importCatalog('paises', filePath, ejecucionId);
  }
  processAirports(filePath: string, ejecucionId?: string) {
    return this.importCatalog('aeropuertos', filePath, ejecucionId);
  }
  processAirlines(filePath: string, ejecucionId?: string) {
    return this.importCatalog('aerolineas', filePath, ejecucionId);
  }
  processRoutes(filePath: string, ejecucionId?: string) {
    return this.importCatalog('rutas', filePath, ejecucionId);
  }

  async importCatalog(
    dataset: CatalogDataset,
    filePath: string | null,
    ejecucionId?: string,
    configuration?: PipelineConfiguration,
  ) {
    const fuente = filePath
      ? fs.createReadStream(filePath)
      : await openCsvSource(
          configuration!.conexion,
          configuration!.configuracionProgramacion.tiempoLimiteSegundos,
        );
    const checksum = createHash('sha256');
    const headers = configuration?.conexion.csvConCabecera ? undefined : false;
    const tamanoLote =
      configuration?.configuracionProgramacion.tamanoLote ?? 2000;
    let total = 0,
      inserted = 0,
      discarded = 0;
    let batch: { row: CatalogRecord; numeroFila: number; sample: string }[] =
      [];
    let samples: {
      intento: number;
      numeroFila: number;
      campo: string | null;
      motivo: string;
      muestraOriginal: string;
    }[] = [];
    let sampleCount = 0;
    let normalizedCodes = 0;
    let omitidas = 0;
    const before = ejecucionId
      ? await this.prisma.models.EjecucionEtl.where({
          id: ejecucionId,
        }).firstOrThrow()
      : null;
    const base = {
      total: before?.filasTotales ?? 0,
      processed: before?.filasProcesadas ?? 0,
      inserted: before?.filasInsertadas ?? 0,
      discarded: before?.filasDescartadas ?? 0,
    };
    const recordDiscard = (
      numeroFila: number,
      motivo: string,
      sample: string,
    ) => {
      discarded++;
      if (sampleCount < MAX_DISCARDED_SAMPLES_PER_JOB) {
        samples.push({
          intento: before?.intento ?? 0,
          numeroFila: base.total + numeroFila,
          campo: motivo.includes(':') ? motivo.split(':')[0] : null,
          motivo,
          muestraOriginal: sample.slice(0, 4096),
        });
        sampleCount++;
      }
    };
    if (ejecucionId) {
      const count = await this.prisma.models.MuestraDescartadaEtl.where({
        ejecucionId,
        intento: before?.intento ?? 0,
      }).aggregate((a) => ({ count: a.count() }));
      sampleCount = Number(count.count);
    }
    const flush = async () => {
      await this.prisma.db.transaction(async (tx) => {
        await bloquearCatalogo(tx);
        let rows = batch.map(({ row }) => row);
        if (dataset === 'rutas' && rows.length) {
          const resolved = await resolveRouteBatch(tx, rows);
          rows = batch.flatMap((entry, index) => {
            const refs = resolved[index];
            if (refs?.motivo) {
              recordDiscard(
                entry.numeroFila,
                `identidad: ${refs.motivo}`,
                entry.sample,
              );
              return [];
            }
            if (
              !refs?.origenId ||
              !refs.destinoId ||
              refs.origenId === refs.destinoId
            ) {
              recordDiscard(
                entry.numeroFila,
                'endpoints: ausentes, ambiguos o iguales',
                entry.sample,
              );
              return [];
            }
            return [
              {
                ...entry.row,
                id: refs.ofertaId,
                origenId: refs.origenId,
                destinoId: refs.destinoId,
                aerolineaId: refs.aerolineaId,
              },
            ];
          });
        }
        if (rows.length) {
          const resultado = await upsertCatalogBatch(tx, dataset, rows);
          inserted += resultado.insertadas;
          omitidas += resultado.omitidas;
        }
        if (ejecucionId) {
          if (samples.length)
            await tx.orm.public.MuestraDescartadaEtl.createAndCount(
              samples.map((sample) => ({ ...sample, ejecucionId })),
            );
          await tx.orm.public.EjecucionEtl.where({ id: ejecucionId }).update({
            filasTotales: base.total + total,
            filasProcesadas: base.processed + total - discarded,
            filasInsertadas: base.inserted + inserted,
            filasDescartadas: base.discarded + discarded,
          });
        }
      });
      batch = [];
      samples = [];
    };
    await proceso(
      fuente,
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          checksum.update(chunk);
          yield chunk;
        }
      },
      csv({
        headers,
        separator: configuration?.conexion.separadorCsv ?? ',',
        maxRowBytes: 1024 * 1024,
        strict: Boolean(headers === undefined),
      }),
      async (rows: AsyncIterable<Record<string, string>>) => {
        for await (const raw of rows) {
          if (
            total === 0 &&
            configuration &&
            configuration.mapeoEsquema.some(
              (rule) => !Object.hasOwn(raw, rule.columnaOrigen),
            )
          )
            throw new Error('El mapeo referencia columnas que no existen');
          total++;
          const safe = configuration
            ? redactSourceRow(raw, configuration.conexion)
            : raw;
          const sample = JSON.stringify(safe).slice(0, 4096);
          try {
            let mapped: Record<string, unknown> = {};
            if (configuration) {
              for (const rule of configuration.mapeoEsquema) {
                let value: string | number | boolean | null | undefined =
                  raw[rule.columnaOrigen];
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
                    throw new Error(`${rule.campoDestino}: booleano invalido`);
                  value =
                    !text || text === String.raw`\N`
                      ? null
                      : ['Y', 'TRUE', '1'].includes(text);
                }
                if (typeof value === 'number' && !Number.isFinite(value))
                  throw new Error(`${rule.campoDestino}: número no finito`);
                if (rule.required && catalogValue(value) === null)
                  throw new Error(`${rule.campoDestino}: obligatorio`);
                mapped[rule.campoDestino] = value;
              }
            } else {
              const columns = OPENFLIGHTS_COLUMNS[dataset];
              if (Object.keys(raw).length !== columns.length)
                throw new Error('columns: cantidad incorrecta');
              mapped = Object.fromEntries(
                columns.map((campo, index) => [campo, raw[String(index)]]),
              );
            }
            const normalized = normalizeCatalogRow(dataset, mapped);
            if (dataset === 'rutas')
              normalized.claveImportacion = claveRutaFuente(normalized);
            for (const rule of configuration?.mapeoEsquema ?? []) {
              if (rule.required && normalized[rule.campoDestino] === null)
                throw new Error(`${rule.campoDestino}: obligatorio o inválido`);
            }
            for (const campo of [
              'iata',
              'icao',
              'codigoIso',
              'codigoOrigen',
              'codigoDestino',
              'codigoAerolinea',
            ]) {
              const original = catalogValue(mapped[campo]);
              if (
                original &&
                !['-', 'N/A'].includes(original.toUpperCase()) &&
                normalized[campo] === null
              ) {
                normalizedCodes++;
                normalized[`${campo}Invalid`] = true;
              }
            }
            batch.push({
              row: normalized,
              numeroFila: total,
              sample,
            });
          } catch (error) {
            recordDiscard(
              total,
              error instanceof Error ? error.message : 'row: invalida',
              sample,
            );
          }
          if (total % tamanoLote === 0) await flush();
        }
        if (batch.length || samples.length || total % tamanoLote !== 0)
          await flush();
      },
    );
    if (total > discarded && dataset !== 'rutas')
      await linkCatalogCountries(this.prisma.db);
    if (dataset === 'rutas') await this.computeRouteCounts();
    if (omitidas && ejecucionId)
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento: before?.intento ?? 0,
        nivel: 'info',
        mensaje: `${dataset}: ${omitidas} filas conservadas por archivo o protección manual`,
      });
    if (normalizedCodes && ejecucionId)
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento: before?.intento ?? 0,
        nivel: 'warn',
        mensaje: `${dataset}: ${normalizedCodes} códigos opcionales inválidos normalizados a NULL`,
      });
    if (ejecucionId && configuration)
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        checksumFuente: checksum.digest('hex'),
      });
    this.logger.log(
      `${dataset}: ${total} leidas, ${total - discarded} procesadas, ${inserted} nuevas, ${discarded} descartadas`,
    );
    return { total, processed: total - discarded, inserted, discarded };
  }

  async computeRouteCounts() {
    await this.prisma.db.transaction(async (tx) => {
      await bloquearCatalogo(tx);
      await recalcularCantidadRutas(tx);
    });
  }
}
