import { createDatabase } from '../src/prisma/db.js';

describe('Completed job integrity (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('rejects missing dates and unaccounted rows, and permits a fully accounted completion', async () => {
    const rollback = new Error('rollback job fixtures');
    try {
      await db.transaction(async (tx) => {
        const job = await tx.orm.public.EtlJob.create({
          source: 'countries',
          status: 'pending',
          totalRows: 10,
        });
        await tx.execute(
          tx.raw.sql`SAVEPOINT invalid_completion`.affectedCount().build(),
        );
        await expect(
          tx.orm.public.EtlJob.where({ id: job.id }).update({
            status: 'completed',
          }),
        ).rejects.toThrow(/etl_jobs_completion_check/);
        await tx.execute(
          tx.raw.sql`ROLLBACK TO SAVEPOINT invalid_completion`
            .affectedCount()
            .build(),
        );
        await expect(
          tx.orm.public.EtlJob.where({ id: job.id }).update({
            status: 'completed',
            startedAt: '2026-10-29 00:00:00',
            finishedAt: '2026-10-29 00:00:01',
          }),
        ).rejects.toThrow(/etl_jobs_completion_check/);
        await tx.execute(
          tx.raw.sql`ROLLBACK TO SAVEPOINT invalid_completion`
            .affectedCount()
            .build(),
        );
        const saved = await tx.orm.public.EtlJob.where({ id: job.id }).update({
          status: 'completed',
          startedAt: '2026-10-29 00:00:00',
          finishedAt: '2026-10-29 00:00:01',
          processedRows: 8,
          discardedRows: 2,
        });
        expect(saved).toMatchObject({
          status: 'completed',
          processedRows: 8,
          discardedRows: 2,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
