import { createDatabase } from '../src/prisma/db.js';

describe('Completed job integrity (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('rejects missing dates and unaccounted rows, and permits a fully accounted completion', async () => {
    const rollback = new Error('rollback job fixtures');
    try {
      await db.transaction(async (tx) => {
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'paises',
          estado: 'pending',
          filasTotales: 10,
        });
        await tx.execute(
          tx.raw.sql`SAVEPOINT invalid_completion`.affectedCount().build(),
        );
        await expect(
          tx.orm.public.EjecucionEtl.where({ id: job.id }).update({
            estado: 'completed',
          }),
        ).rejects.toThrow(/etl_jobs_completion_check/);
        await tx.execute(
          tx.raw.sql`ROLLBACK TO SAVEPOINT invalid_completion`
            .affectedCount()
            .build(),
        );
        await expect(
          tx.orm.public.EjecucionEtl.where({ id: job.id }).update({
            estado: 'completed',
            iniciadoEn: '2026-10-29 00:00:00',
            finalizadoEn: '2026-10-29 00:00:01',
          }),
        ).rejects.toThrow(/etl_jobs_completion_check/);
        await tx.execute(
          tx.raw.sql`ROLLBACK TO SAVEPOINT invalid_completion`
            .affectedCount()
            .build(),
        );
        const saved = await tx.orm.public.EjecucionEtl.where({
          id: job.id,
        }).update({
          estado: 'completed',
          iniciadoEn: '2026-10-29 00:00:00',
          finalizadoEn: '2026-10-29 00:00:01',
          filasProcesadas: 8,
          filasDescartadas: 2,
        });
        expect(saved).toMatchObject({
          estado: 'completed',
          filasProcesadas: 8,
          filasDescartadas: 2,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
