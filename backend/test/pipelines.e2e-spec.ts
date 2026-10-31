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
    const rollback = new Error('rollback proceso verification');
    try {
      await db.transaction(async (tx) => {
        const queue = {
          add: jest.fn().mockResolvedValue({}),
          upsertJobScheduler: jest.fn(),
          removeJobScheduler: jest.fn(),
          setGlobalConcurrency: jest.fn(),
        };
        const service = new PipelinesService(
          { models: tx.orm.public, db: tx } as unknown as PrismaService,
          queue as unknown as Queue,
        );
        const dto: CreatePipelineDto = {
          nombre: 'Pipeline fixture',
          nombreConjunto: 'paises',
          entidadDestino: 'paises',
          conexion: {
            tipoFuente: 'http_stream',
            urlEndpoint:
              'https://raw.githubusercontent.com/jpatokal/openflights/master/data/countries.dat',
            metodoHttp: 'GET',
            formatoDatos: 'csv',
            csvConCabecera: false,
          },
          mapeoEsquema: [
            { columnaOrigen: '0', campoDestino: 'nombre' },
            { columnaOrigen: '1', campoDestino: 'codigoIso' },
          ],
          configuracionProgramacion: {
            expresionCron: '0 4 * * *',
            tamanoLote: 2000,
            tiempoLimiteSegundos: 300,
            maximoReintentos: 2,
          },
        };
        const proceso = await service.create(dto);
        expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
          proceso.id,
          { pattern: '0 4 * * *', tz: 'UTC' },
          expect.objectContaining({ name: 'scheduled-pipeline' }),
        );
        const execution = await service.run(proceso.id);
        expect(execution).not.toBeNull();
        const job = await service.job(execution!.ejecucionId);
        expect(job.instantaneaConfiguracion).toMatchObject({
          mapeoEsquema: dto.mapeoEsquema,
        });
        await service.update(proceso.id, {
          mapeoEsquema: [{ columnaOrigen: '1', campoDestino: 'nombre' }],
        });
        expect((await service.job(job.id)).instantaneaConfiguracion).toEqual(
          job.instantaneaConfiguracion,
        );
        await service.update(proceso.id, { pausado: true });
        expect(queue.removeJobScheduler).toHaveBeenCalledWith(proceso.id);
        await expect(service.run(proceso.id)).rejects.toThrow(/pausado/);
        await service.archive(proceso.id);
        expect((await service.job(job.id)).procesoId).toBe(proceso.id);
        await expect(service.run(proceso.id)).rejects.toThrow(/no encontrado/);
        const another = await service.create({
          ...dto,
          nombre: 'Queue failure fixture',
        });
        queue.add.mockRejectedValueOnce(
          new Error('internal Redis credentials'),
        );
        await expect(service.run(another.id)).rejects.toThrow(/encolar/);
        const failed = await tx.orm.public.EjecucionEtl.where({
          procesoId: another.id,
        }).firstOrThrow();
        expect(failed.estado).toBe('failed');
        expect(failed.mensajeError).not.toContain('credentials');
        await tx.orm.public.ProcesoEtl.where({ id: another.id }).update({
          mapeoEsquema: [null],
        });
        await expect(service.run(another.id)).rejects.toThrow(/Bad Request/);
        await expect(service.onModuleInit()).resolves.toBeUndefined();
        expect(queue.removeJobScheduler).toHaveBeenCalledWith(another.id);
        throw rollback;
      });
      throw new Error('Expected rollback');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
