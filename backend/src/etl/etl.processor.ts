import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { resolve } from 'node:path';
import { EtlService } from './etl.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PipelinesService } from './pipelines.service.js';
import { ETL_DATASETS } from './dto/trigger-etl.dto.js';
import type { CatalogDataset } from './catalog.js';

@Processor('etl-queue', { concurrency: 1 })
export class EtlProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlProcessor.name);
  constructor(
    private readonly etlService: EtlService,
    private readonly prisma: PrismaService,
    private readonly pipelines: PipelinesService,
  ) {
    super();
  }

  async process(
    job: Job<{ jobId: string; dataset: string; pipelineId?: string }>,
  ) {
    if (job.name === 'scheduled-pipeline') {
      if (!job.data.pipelineId) throw new Error('Pipeline obligatorio');
      return this.pipelines.run(job.data.pipelineId, undefined, true);
    }
    const { jobId, dataset } = job.data;
    const now = () =>
      new Date().toISOString().replace('T', ' ').replace('Z', '');
    await this.prisma.models.EtlJob.where({ id: jobId }).update({
      status: 'running',
      startedAt: now(),
      finishedAt: null,
      errorMessage: null,
      sourceChecksum: null,
      totalRows: 0,
      processedRows: 0,
      insertedRows: 0,
      discardedRows: 0,
    });
    await this.prisma.models.EtlJobEvent.create({
      jobId,
      level: 'info',
      message: `Inicio del intento ${job.attemptsMade + 1}`,
    });
    try {
      if (!ETL_DATASETS.includes(dataset))
        throw new Error('Dataset no soportado');
      const record = await this.prisma.models.EtlJob.where({
        id: jobId,
      }).firstOrThrow();
      const config = record.configurationSnapshot
        ? await this.pipelines.validateConfiguration(dataset, record.configurationSnapshot)
        : null;
      let processedRows = 0,
        insertedRows = 0,
        discardedRows = 0;
      const datasets: CatalogDataset[] =
        dataset === 'all'
          ? ['countries', 'airports', 'airlines', 'routes']
          : [dataset as CatalogDataset];
      for (const target of datasets) {
        const result = await this.etlService.importCatalog(
          target,
          config ? null : resolve(process.cwd(), 'data', `${target}.dat`),
          jobId,
          config ?? undefined,
        );
        processedRows += result.processed;
        insertedRows += result.inserted;
        discardedRows += result.discarded;
        await this.prisma.models.EtlJobEvent.create({
          jobId,
          level: 'info',
          message: `${target}: ${result.processed} procesadas, ${result.inserted} nuevas, ${result.discarded} descartadas`,
        });
      }
      await this.prisma.models.EtlJob.where({ id: jobId }).update({
        status: 'completed',
        finishedAt: now(),
      });
      await this.prisma.models.EtlJobEvent.create({
        jobId,
        level: 'success',
        message: 'Ingesta completada',
      });
      return { success: true, processedRows, insertedRows, discardedRows };
    } catch {
      const message =
        'Falló la lectura o persistencia del catálogo; el reintento es idempotente';
      this.logger.error(`${jobId}: ${message}`);
      await this.prisma.models.EtlJob.where({ id: jobId }).update({
        status: 'failed',
        finishedAt: now(),
        errorMessage: message,
      });
      await this.prisma.models.EtlJobEvent.create({
        jobId,
        level: 'error',
        message,
      });
      throw new Error(message);
    }
  }
}
