import { randomUUID } from 'node:crypto';
import { exigirIngestaDisponible } from '../src/ingestion/infrastructure/admision-operaciones.js';
import { bloquearMesAnac } from '../src/prisma/bloqueo-transaccional.js';
import { disposableDatabase } from './helpers/disposable-database.js';

describe('Admisión exclusiva de operaciones', () => {
  const db = disposableDatabase();
  afterAll(() => db.close());

  it('admite una sola ejecución concurrente y reabre el cupo al terminar', async () => {
    const oagId = randomUUID();
    const btsId = randomUUID();
    const admitir = (fuente: 'OAG' | 'BTS', id: string) =>
      db.transaction(async (tx) => {
        await exigirIngestaDisponible(tx);
        await tx.orm.public.EjecucionEtl.create({
          id,
          fuente,
          estado: 'pending',
        });
        return id;
      });

    try {
      const resultados = await Promise.allSettled([
        admitir('OAG', oagId),
        admitir('BTS', btsId),
      ]);
      const aceptadas = resultados.filter((r) => r.status === 'fulfilled');
      const rechazadas = resultados.filter((r) => r.status === 'rejected');
      expect(aceptadas).toHaveLength(1);
      expect(rechazadas).toHaveLength(1);
      const activa = aceptadas[0].value;
      expect(rechazadas[0].reason).toMatchObject({
        status: 409,
        response: { ejecucionId: activa },
      });
      await db.orm.public.EjecucionEtl.where({ id: activa }).update({
        estado: 'failed',
      });
      if (activa === oagId)
        await expect(admitir('BTS', btsId)).resolves.toBe(btsId);
      else await expect(admitir('OAG', oagId)).resolves.toBe(oagId);
    } finally {
      await db.execute(
        db.raw.sql`DELETE FROM ejecuciones_etl WHERE id IN (${oagId}, ${btsId})`
          .affectedCount()
          .build(),
      );
    }
  });
  it('bloquea un mes ANAC sin bloquear otro período', async () => {
    const otraConexion = disposableDatabase();
    const periodo = '2099-07';
    const recurso = `anac:${periodo}`;
    try {
      await db.transaction((tx) => bloquearMesAnac(tx, periodo));
      await db.transaction(async (tx) => {
        await bloquearMesAnac(tx, periodo);
        await otraConexion.transaction((otro) =>
          bloquearMesAnac(otro, '2099-08'),
        );
        await expect(
          otraConexion.transaction(async (otro) => {
            await otro.orm.public.BloqueoTransaccional.where({ recurso })
              .forUpdate({ nowait: true })
              .firstOrThrow();
          }),
        ).rejects.toThrow(/could not obtain lock/i);
      });
    } finally {
      await db.orm.public.BloqueoTransaccional.where((b) =>
        b.recurso.in([recurso, 'anac:2099-08']),
      ).deleteAndCount();
      await otraConexion.close();
    }
  });
});
