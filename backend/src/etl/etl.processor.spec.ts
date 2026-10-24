import { mockCollection } from '../../test/helpers/prisma-mock.js';
import { EtlProcessor } from './etl.processor.js';
import { EtlService } from './etl.service.js';
import { PipelinesService } from './pipelines.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Job } from 'bullmq';

describe('EtlProcessor', () => {
  const jobs = mockCollection();
  const events = mockCollection();
  const importCatalog = jest.fn();
  const run = jest.fn();
  const processor = new EtlProcessor(
    { importCatalog } as unknown as EtlService,
    {
      models: { EtlJob: jobs, EtlJobEvent: events },
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
    jobs.firstOrThrow.mockResolvedValue({ configurationSnapshot: null });
    importCatalog.mockResolvedValue({
      total: 3,
      processed: 2,
      inserted: 1,
      discarded: 1,
    });
  });
  it('clears attempt counters and imports references before routes', async () => {
    await expect(processor.process(job)).resolves.toEqual({
      success: true,
      processedRows: 8,
      insertedRows: 4,
      discardedRows: 4,
    });
    expect(importCatalog.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'countries',
      'airports',
      'airlines',
      'routes',
    ]);
    expect(jobs.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        totalRows: 0,
        processedRows: 0,
        insertedRows: 0,
        discardedRows: 0,
        finishedAt: null,
        sourceChecksum: null,
      }),
    );
    expect(jobs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'completed' }),
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
    expect(jobs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
  it('keeps internal failure details out of job responses and retries through BullMQ', async () => {
    importCatalog.mockRejectedValueOnce(new Error('password=secret'));
    await expect(processor.process(job)).rejects.toThrow(/Falló/);
    expect(jobs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: expect.not.stringContaining('secret'),
      }),
    );
  });
  it('scheduled invocations capture a new execution through the pipeline service', async () => {
    await processor.process({
      ...job,
      name: 'scheduled-pipeline',
      data: { pipelineId: 'pipeline-1' },
    } as unknown as typeof job);
    expect(run).toHaveBeenCalledWith('pipeline-1', undefined, true);
  });
});
