import { mockCollection } from '../../test/helpers/prisma-mock.js';
import { EtlProcessor } from './etl.processor.js';
import { EtlService } from './etl.service.js';
import { PipelinesService } from './pipelines.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Job } from 'bullmq';

describe('EtlProcessor', () => {
  const ejecuciones = mockCollection();
  const eventos = mockCollection();
  const importCatalog = jest.fn();
  const run = jest.fn();
  const processor = new EtlProcessor(
    { importCatalog } as unknown as EtlService,
    {
      models: { EjecucionEtl: ejecuciones, EventoEjecucionEtl: eventos },
    } as unknown as PrismaService,
    { run } as unknown as PipelinesService,
  );
  const job = {
    name: 'process-dataset',
    attemptsMade: 0,
    data: { jobId: 'job-1', dataset: 'all' },
  } as Job<{ jobId: string; dataset: string }>;
  beforeEach(() => {
    jest.clearAllMocks();
    ejecuciones.firstOrThrow.mockResolvedValue({
      instantaneaConfiguracion: null,
    });
    importCatalog.mockResolvedValue({
      total: 3,
      processed: 2,
      inserted: 1,
      discarded: 1,
    });
  });
  it('clears intento counters and imports references before rutas', async () => {
    await expect(processor.process(job)).resolves.toEqual({
      success: true,
      filasProcesadas: 8,
      filasInsertadas: 4,
      filasDescartadas: 4,
    });
    expect(importCatalog.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'paises',
      'aeropuertos',
      'aerolineas',
      'rutas',
    ]);
    expect(ejecuciones.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        filasTotales: 0,
        filasProcesadas: 0,
        filasInsertadas: 0,
        filasDescartadas: 0,
        finalizadoEn: null,
        checksumFuente: null,
      }),
    );
    expect(ejecuciones.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'completed' }),
    );
  });
  it('acepta un trabajo persistido con el nombre anterior del conjunto', async () => {
    await processor.process({
      ...job,
      data: { jobId: 'job-1', dataset: 'airports' },
    });
    expect(importCatalog).toHaveBeenCalledWith(
      'aeropuertos',
      expect.stringContaining('airports.dat'),
      'job-1',
      undefined,
    );
  });

  it('does not silently complete unsupported datasets', async () => {
    await expect(
      processor.process({
        ...job,
        data: { jobId: 'job-1', dataset: 'unknown' },
      } as typeof job),
    ).rejects.toThrow();
    expect(importCatalog).not.toHaveBeenCalled();
    expect(ejecuciones.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'failed' }),
    );
  });
  it('keeps internal failure details out of job responses and retries through BullMQ', async () => {
    importCatalog.mockRejectedValueOnce(new Error('password=secret'));
    await expect(processor.process(job)).rejects.toThrow(/Falló/);
    expect(ejecuciones.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        estado: 'failed',
        mensajeError: expect.not.stringContaining('secret'),
      }),
    );
  });
  it('scheduled invocations capture a new execution through the proceso service', async () => {
    await processor.process({
      ...job,
      name: 'scheduled-pipeline',
      data: { pipelineId: 'proceso-1' },
    } as unknown as typeof job);
    expect(run).toHaveBeenCalledWith('proceso-1', undefined, true);
  });
});
