import {
  consultaCantidadesRutas,
  conCantidadesRutas,
} from '../src/catalogos/cantidades-rutas.js';
import { createDatabase } from '../src/prisma/db.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { crearOfertaFixture } from './helpers/oferta-fixture.js';

describe('Conteo tipado de rutas visibles', () => {
  const db = createDatabase();
  afterAll(() => db.close());

  it('cuenta extremos sin duplicar ofertas y respeta archivos y aeropuertos sin rutas', async () => {
    const rollback = new Error('rollback conteos');
    await expect(
      db.transaction(async (tx) => {
        const aeropuertos = [];
        for (const nombre of ['Origen', 'Destino', 'Sin rutas']) {
          aeropuertos.push(
            await tx.orm.public.Aeropuerto.create({
              nombre,
              nombrePais: 'Prueba',
              latitud: 0,
              longitud: 0,
              ubicacion: ubicacionAeropuerto(0, 0),
            }),
          );
        }
        const [origen, destino] = aeropuertos;
        const operadora = await tx.orm.public.Aerolinea.create({
          nombre: 'Operadora conteos',
        });
        await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: destino.id,
          aerolineaId: operadora.id,
          codigoAerolinea: 'T1',
        });
        const segunda = await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: destino.id,
          codigoAerolinea: 'T2',
        });
        const retorno = await crearOfertaFixture(tx, {
          origenId: destino.id,
          destinoId: origen.id,
          codigoAerolinea: 'RT',
        });
        const comprobar = async (esperado: number[]) => {
          const conteos = await tx.query(consultaCantidadesRutas(tx).build());
          const rows = aeropuertos.map(({ id }) => ({
            id,
            cantidadRutas: Number(
              conteos.find((r) => r.aeropuerto_id === id)?.cantidad ?? 0,
            ),
          }));
          const cantidades = new Map(rows.map((a) => [a.id, a.cantidadRutas]));
          expect(aeropuertos.map(({ id }) => cantidades.get(id))).toEqual(
            esperado,
          );
          expect(rows).toEqual(
            expect.arrayContaining(
              await conCantidadesRutas(
                tx,
                aeropuertos.map(({ id }) => ({ id })),
              ),
            ),
          );
        };
        await comprobar([2, 2, 0]);
        await tx.orm.public.Aerolinea.where({ id: operadora.id }).update({
          archivadoEn: '2026-11-20 00:00:00',
        });
        await comprobar([2, 2, 0]);
        await tx.orm.public.OfertaRuta.where({ id: segunda.id }).update({
          archivadoEn: '2026-11-20 00:00:00',
        });
        await comprobar([1, 1, 0]);
        await tx.orm.public.Ruta.where({ id: retorno.rutaId }).update({
          archivadoEn: '2026-11-20 00:00:00',
        });
        await comprobar([0, 0, 0]);
        await tx.orm.public.Ruta.where({ id: retorno.rutaId }).update({
          archivadoEn: null,
        });
        await tx.orm.public.Aeropuerto.where({ id: destino.id }).update({
          archivadoEn: '2026-11-20 00:00:00',
        });
        await comprobar([0, 0, 0]);
        await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: origen.id,
          codigoAerolinea: 'LP',
        });
        await comprobar([2, 0, 0]);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
