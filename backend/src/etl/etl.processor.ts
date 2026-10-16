import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EtlService } from './etl.service';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';

@Processor('etl-queue')
export class EtlProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlProcessor.name);

  constructor(
    private readonly etlService: EtlService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; dataset: string }>) {
    const { jobId, dataset } = job.data;
    const startTime = Date.now();
    this.logger.log(
      `Iniciando procesamiento de ETL job ${jobId} para dataset ${dataset}`,
    );

    await this.prisma.etlJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const dataDir = path.resolve(process.cwd(), 'data');
      let totalRows = 0;
      let processedRows = 0;
      let discardedRows = 0;

      if (dataset === 'countries' || dataset === 'all') {
        const res = await this.etlService.processCountries(
          path.join(dataDir, 'countries.dat'),
        );
        totalRows += res.total;
        processedRows += res.inserted;
      }

      if (dataset === 'airports' || dataset === 'all') {
        const res = await this.etlService.processAirports(
          path.join(dataDir, 'airports.dat'),
        );
        totalRows += res.total;
        processedRows += res.inserted;
        discardedRows += res.discarded;
      }

      if (dataset === 'airlines' || dataset === 'all') {
        const res = await this.etlService.processAirlines(
          path.join(dataDir, 'airlines.dat'),
        );
        totalRows += res.total;
        processedRows += res.inserted;
        discardedRows += res.discarded;
      }

      await this.etlService.computeRoutePopularityAndTop100();

      const durationMs = Date.now() - startTime;
      await this.prisma.etlJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          durationMs,
          totalRows,
          processedRows,
          discardedRows,
        },
      });

      this.logger.log(
        `ETL Job ${jobId} finalizado exitosamente en ${durationMs}ms`,
      );
      return { success: true, processedRows, discardedRows };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error desconocido durante ETL';
      this.logger.error(`Fallo en ETL Job ${jobId}: ${errorMsg}`);
      await this.prisma.etlJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage: errorMsg,
        },
      });
      throw err;
    }
  }
}
