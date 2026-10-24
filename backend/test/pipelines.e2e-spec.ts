import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PipelinesService } from '../src/etl/pipelines.service.js';
import { CreatePipelineDto } from '../src/etl/dto/pipeline.dto.js';
import type { Queue } from 'bullmq';

// Real JSON persistence and constraints, with only the Redis enqueue boundary replaced.
describe('Pipeline persistence and immutable execution configuration', () => {
  const db = createDatabase();
  afterAll(async () => {
    await db.close();
  });
  it('keeps captured mappings, schedules natively, archives without losing audit, and handles enqueue failures', async () => {
    const rollback = new Error('rollback pipeline verification');
    try {
      await db.transaction(async (tx) => {
        const queue = {
          add: jest.fn().mockResolvedValue({}),
          upsertJobScheduler: jest.fn(),
          removeJobScheduler: jest.fn(),
        };
        const service = new PipelinesService(
          { models: tx.orm.public, db: tx } as unknown as PrismaService,
          queue as unknown as Queue,
        );
        const dto: CreatePipelineDto = {
          name: 'Pipeline fixture',
          datasetName: 'countries',
          targetEntity: 'countries',
          connection: {
            sourceType: 'http_stream',
            endpointUrl:
              'https://raw.githubusercontent.com/jpatokal/openflights/master/data/countries.dat',
            httpMethod: 'GET',
            dataFormat: 'csv',
            csvHasHeader: false,
          },
          schemaMapping: [
            { sourceColumn: '0', targetField: 'name' },
            { sourceColumn: '1', targetField: 'isoCode' },
          ],
          scheduleConfig: {
            cronExpression: '0 4 * * *',
            batchSize: 2000,
            timeoutSeconds: 300,
            maxRetries: 2,
          },
        };
        const pipeline = await service.create(dto);
        expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
          pipeline.id,
          { pattern: '0 4 * * *', tz: 'UTC' },
          expect.objectContaining({ name: 'scheduled-pipeline' }),
        );
        const execution = await service.run(pipeline.id);
        expect(execution).not.toBeNull();
        const job = await service.job(execution!.jobId);
        expect(job.configurationSnapshot).toMatchObject({
          schemaMapping: dto.schemaMapping,
        });
        await service.update(pipeline.id, {
          schemaMapping: [{ sourceColumn: '1', targetField: 'name' }],
        });
        expect((await service.job(job.id)).configurationSnapshot).toEqual(
          job.configurationSnapshot,
        );
        await service.update(pipeline.id, { paused: true });
        expect(queue.removeJobScheduler).toHaveBeenCalledWith(pipeline.id);
        await expect(service.run(pipeline.id)).rejects.toThrow(/pausado/);
        await service.archive(pipeline.id);
        expect((await service.job(job.id)).pipelineId).toBe(pipeline.id);
        await expect(service.run(pipeline.id)).rejects.toThrow(/no encontrado/);
        const another = await service.create({
          ...dto,
          name: 'Queue failure fixture',
        });
        queue.add.mockRejectedValueOnce(
          new Error('internal Redis credentials'),
        );
        await expect(service.run(another.id)).rejects.toThrow(/encolar/);
        const failed = await tx.orm.public.EtlJob.where({
          pipelineId: another.id,
        }).firstOrThrow();
        expect(failed.status).toBe('failed');
        expect(failed.errorMessage).not.toContain('credentials');
        throw rollback;
      });
      throw new Error('Expected rollback');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
