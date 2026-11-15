import { mockCollection } from '../../test/helpers/prisma-mock.js';
import { EtlProcessor } from './etl.processor.js';
import { CatalogImportService } from './catalog-import.service.js';
import { PipelinesService } from './pipelines.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('EtlProcessor', () => {
  const ejecuciones = mockCollection();
  const eventos = mockCollection();
  const importCatalog = jest.fn();
  const run = jest.fn();
  const cerrarCargaLocal = jest.fn();
  const config = {
    conexion: {},
    configuracionProgramacion: { tiempoLimiteSegundos: 300 },
  };
  const validateConfiguration = jest.fn().mockResolvedValue(config);
  const record = {
    fuente: 'aeropuertos',
    instantaneaConfiguracion: config,
  };
  const processor = new EtlProcessor(
    { importCatalog } as unknown as CatalogImportService,
    {
      models: { EjecucionEtl: ejecuciones, EventoEjecucionEtl: eventos },
    } as unknown as PrismaService,
    {
      run,
      cerrarCargaLocal,
      validateConfiguration,
    } as unknown as PipelinesService,
  );
  const crearJob = (dataset = 'aeropuertos') =>
    ({
      name: 'process-dataset',
      attemptsMade: 0,
      data: { jobId: 'job-1', dataset },
    }) as Parameters<EtlProcessor['process']>[0];
  const job = crearJob();
  beforeEach(() => {
    jest.clearAllMocks();
    ejecuciones.firstOrThrow.mockResolvedValue(record);
    importCatalog.mockResolvedValue({
      total: 3,
      processed: 2,
      inserted: 1,
      discarded: 1,
    });
  });
  it('clears intento counters and imports the configured source', async () => {
    await expect(processor.process(job)).resolves.toEqual({
      success: true,
      filasProcesadas: 2,
      filasInsertadas: 1,
      filasDescartadas: 1,
    });
    expect(importCatalog).toHaveBeenCalledWith(
      'aeropuertos',
      expect.objectContaining({ pipe: expect.any(Function) }),
      'job-1',
      config,
    );
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
  it('rejects old local jobs permanently before opening a source', async () => {
    const local = { ...record, instantaneaConfiguracion: null };
    ejecuciones.firstOrThrow.mockResolvedValueOnce(local);
    await expect(processor.process(crearJob('all'))).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });
    expect(cerrarCargaLocal).toHaveBeenCalledWith(local);
    expect(importCatalog).not.toHaveBeenCalled();
  });

  it('does not silently complete unsupported datasets', async () => {
    ejecuciones.firstOrThrow.mockResolvedValueOnce({
      ...record,
      fuente: 'unknown',
    });
    await expect(processor.process(crearJob('unknown'))).rejects.toThrow();
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
