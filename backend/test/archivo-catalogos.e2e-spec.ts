import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { crearOfertaFixture } from './helpers/oferta-fixture.js';
import { Test } from '@nestjs/testing';
import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AirportsService } from '../src/airports/airports.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RoutesService } from '../src/routes/routes.service.js';
import { CountriesService } from '../src/countries/countries.service.js';

describe('Archivo lógico de catálogos (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('oculta aeropuertos y sus rutas, conserva las filas y consulta países por su relación', async () => {
    const rollback = new Error('rollback archivo');
    try {
      await db.transaction(async (tx: Transaction) => {
        const pais = await tx.orm.public.Pais.create({
          nombre: 'País de prueba archivo',
        });
        const origen = await tx.orm.public.Aeropuerto.create({
          nombre: 'Archivo origen',
          nombrePais: 'Etiqueta original',
          paisId: pais.id,
          latitud: -34,
          longitud: -58,
          ubicacion: ubicacionAeropuerto(-34, -58),
        });
        const destino = await tx.orm.public.Aeropuerto.create({
          nombre: 'Archivo destino',
          nombrePais: 'Etiqueta original',
          paisId: pais.id,
          latitud: 25,
          longitud: -80,
          ubicacion: ubicacionAeropuerto(25, -80),
        });
        const ruta = await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: destino.id,
        });
        const module = await Test.createTestingModule({
          providers: [
            AirportsService,
            {
              provide: RedisService,
              useValue: {
                get: () => Promise.resolve(null),
                set: () => Promise.resolve(),
              },
            },
            RoutesService,
            CountriesService,
            {
              provide: PrismaService,
              useValue: { models: tx.orm.public, db: tx },
            },
          ],
        }).compile();
        try {
          expect(
            (
              await module.get(CountriesService).findByName(pais.nombre)
            ).aeropuertos.map((a) => a.id),
          ).toContain(origen.id);
          await tx.execute(
            tx.raw
              .sql`UPDATE aeropuertos SET archivado_en=now() WHERE id=${origen.id}`
              .affectedCount()
              .build(),
          );
          expect(
            await module
              .get(AirportsService)
              .search({ q: 'Archivo origen', limit: 20 }),
          ).toEqual([]);
          expect(
            await module
              .get(RoutesService)
              .explore({ origenId: origen.id, destinoId: destino.id }),
          ).toEqual([]);
          expect(
            await tx.orm.public.OfertaRuta.first({ id: ruta.id }),
          ).toBeDefined();

          const rutas = module.get(RoutesService);
          const consulta = { busqueda: 'Archivo', pagina: 1, limite: 20 };
          expect(
            await rutas.listarAdmin({ ...consulta, estado: 'vigentes' }),
          ).toMatchObject({ total: 1, datos: [{ id: ruta.rutaId }] });
          expect(
            await rutas.listarAdmin({
              ...consulta,
              busqueda: '%',
              estado: 'todos',
            }),
          ).toMatchObject({ total: 0, datos: [] });

          await tx.execute(
            tx.raw
              .sql`UPDATE rutas SET archivado_en=now() WHERE id=${ruta.rutaId}`
              .affectedCount()
              .build(),
          );
          expect(
            await rutas.listarAdmin({ ...consulta, estado: 'vigentes' }),
          ).toMatchObject({ total: 0, datos: [] });
          for (const estado of ['archivados', 'todos'] as const) {
            expect(
              await rutas.listarAdmin({ ...consulta, estado }),
            ).toMatchObject({ total: 1, datos: [{ id: ruta.rutaId }] });
          }
          await expect(
            tx.orm.public.Aeropuerto.where({ id: destino.id }).delete(),
          ).rejects.toThrow(/foreign key/i);
        } finally {
          await module.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
