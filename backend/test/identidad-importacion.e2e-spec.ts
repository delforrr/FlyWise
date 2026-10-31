import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { createReadStream } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EtlService } from '../src/etl/etl.service.js';
import {
  OPENFLIGHTS_COLUMNS,
  normalizeCatalogRow,
  claveRutaFuente,
} from '../src/etl/catalog.js';
import { resolveRouteBatch } from '../src/etl/catalog-store.js';

describe('Claves de importación con una fila real de routes.dat', () => {
  const db = createDatabase();
  let directorio: string;
  let fichero: string;
  let linea: string;
  beforeAll(async () => {
    directorio = await mkdtemp(join(tmpdir(), 'flywise-identidad-'));
    fichero = join(directorio, 'routes.dat');
    const fuente = createReadStream(resolve('data/routes.dat'));
    const lector = createInterface({ input: fuente, crlfDelay: Infinity });
    try {
      for await (const registro of lector) {
        linea = registro;
        break;
      }
    } finally {
      lector.close();
      fuente.destroy();
    }
    expect(linea).not.toContain('"');
  });
  afterAll(async () => {
    await db.close();
    if (directorio) await rm(directorio, { recursive: true, force: true });
  });

  async function aislado(
    trabajo: (tx: Transaction, service: EtlService) => Promise<void>,
  ) {
    const rollback = new Error('rollback identidad');
    try {
      await db.transaction(async (tx) => {
        const module = await Test.createTestingModule({
          providers: [
            EtlService,
            { provide: getQueueToken('etl-queue'), useValue: {} },
            {
              provide: PrismaService,
              useValue: {
                models: tx.orm.public,
                db: {
                  raw: tx.raw,
                  query: tx.query.bind(tx),
                  execute: tx.execute.bind(tx),
                  transaction: async <T>(
                    work: (inner: Transaction) => Promise<T>,
                  ) => work(tx),
                },
              },
            },
          ],
        }).compile();
        try {
          await trabajo(tx, module.get(EtlService));
        } finally {
          await module.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  function referencia() {
    const celdas = linea.split(',');
    const row = normalizeCatalogRow(
      'rutas',
      Object.fromEntries(
        OPENFLIGHTS_COLUMNS.rutas.map((columna, i) => [columna, celdas[i]]),
      ),
    );
    return { ...row, claveImportacion: claveRutaFuente(row) };
  }

  it('reconoce la clave exacta y conserva una oferta archivada', async () => {
    await aislado(async (tx, service) => {
      const [refs] = await resolveRouteBatch(tx, [referencia()]);
      expect(refs.ofertaId).not.toBeNull();
      await tx.orm.public.OfertaRuta.where({ id: refs.ofertaId! }).update({
        aerolineaId: null,
        archivadoEn: '2026-10-30 00:00:00',
      });
      await writeFile(fichero, linea + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        inserted: 0,
        discarded: 0,
      });
      expect(
        await tx.orm.public.OfertaRuta.first({ id: refs.ofertaId! }),
      ).toMatchObject({
        aerolineaId: null,
        archivadoEn: '2026-10-30 00:00:00',
      });
    });
  });

  it('crea otra oferta cuando cambia la clave y las condiciones, reutilizando la ruta', async () => {
    await aislado(async (tx, service) => {
      const [refs] = await resolveRouteBatch(tx, [referencia()]);
      const anterior = await tx.orm.public.OfertaRuta.firstOrThrow({
        id: refs.ofertaId!,
      });
      const celdas = linea.split(',');
      celdas[7] = '99';
      await writeFile(fichero, celdas.join(',') + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        inserted: 1,
        discarded: 0,
      });
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        inserted: 0,
        discarded: 0,
      });
      const nueva = await tx.orm.public.OfertaRuta.firstOrThrow({
        rutaId: anterior.rutaId,
        escalas: 99,
      });
      expect(nueva.id).not.toBe(anterior.id);
      expect(nueva.claveImportacion).not.toBe(anterior.claveImportacion);
      expect(
        await tx.orm.public.OfertaRuta.first({ id: anterior.id }),
      ).toMatchObject({ escalas: anterior.escalas });
    });
  });

  it('crea una ruta y su oferta cuando el nuevo par de aeropuertos no existe', async () => {
    await aislado(async (tx, service) => {
      const aeropuerto = await tx.orm.public.Aeropuerto.create({
        idOpenflights: 2147483001,
        nombre: 'Origen nuevo de importación',
        iata: 'ZZZ',
        nombrePais: 'Test',
        latitud: 1,
        longitud: 2,
      });
      const celdas = linea.split(',');
      celdas[2] = 'ZZZ';
      celdas[3] = '2147483001';
      await writeFile(fichero, celdas.join(',') + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        inserted: 1,
        discarded: 0,
      });
      const ruta = await tx.orm.public.Ruta.firstOrThrow({
        origenId: aeropuerto.id,
      });
      expect(
        await tx.orm.public.OfertaRuta.first({ rutaId: ruta.id }),
      ).not.toBeNull();
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        inserted: 0,
        discarded: 0,
      });
    });
  });

  it('omite y audita una clave nueva si sus condiciones ya existen, sin fusionar ofertas', async () => {
    await aislado(async (tx, service) => {
      const [refs] = await resolveRouteBatch(tx, [referencia()]);
      const anterior = await tx.orm.public.OfertaRuta.firstOrThrow({
        id: refs.ofertaId!,
      });
      const celdas = linea.split(',');
      celdas[1] = String.raw`\N`;
      await writeFile(fichero, celdas.join(',') + '\n');
      const job = await tx.orm.public.EjecucionEtl.create({
        fuente: 'rutas',
        estado: 'running',
      });
      expect(
        await service.importCatalog('rutas', fichero, job.id),
      ).toMatchObject({ processed: 0, inserted: 0, discarded: 1 });
      expect(
        await tx.orm.public.MuestraDescartadaEtl.first({ ejecucionId: job.id }),
      ).toMatchObject({
        campo: 'identidad',
        motivo: expect.stringContaining('ambigua'),
      });
      expect(await tx.orm.public.OfertaRuta.first({ id: anterior.id })).toEqual(
        anterior,
      );
    });
  });

  it('conserva la edición manual cuando vuelve a llegar la misma clave', async () => {
    await aislado(async (tx, service) => {
      const [refs] = await resolveRouteBatch(tx, [referencia()]);
      await tx.orm.public.OfertaRuta.where({ id: refs.ofertaId! }).update({
        escalas: 99,
        protegidoManualmente: true,
      });
      await writeFile(fichero, linea + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        inserted: 0,
        discarded: 0,
      });
      expect(
        await tx.orm.public.OfertaRuta.first({ id: refs.ofertaId! }),
      ).toMatchObject({ escalas: 99, protegidoManualmente: true });
    });
  });

  it('omite claves distintas que convergen en una oferta dentro del mismo lote', async () => {
    await aislado(async (_tx, service) => {
      const celdas = linea.split(',');
      celdas[7] = '99';
      const primera = celdas.join(',');
      celdas[1] = String.raw`\N`;
      await writeFile(fichero, primera + '\n' + celdas.join(',') + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        processed: 0,
        inserted: 0,
        discarded: 2,
      });
    });
  });

  it('deduplica filas idénticas sin descartarlas ni crear dos ofertas', async () => {
    await aislado(async (_tx, service) => {
      const celdas = linea.split(',');
      celdas[7] = '99';
      const registro = celdas.join(',') + '\n';
      await writeFile(fichero, registro + registro);
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        processed: 2,
        inserted: 1,
        discarded: 0,
      });
    });
  });

  it.each(['ZZ', String.raw`\N`])(
    'omite y audita códigos contradictorios (%s) para la misma clave dentro de un lote',
    async (codigo) => {
      await aislado(async (tx, service) => {
        const celdas = linea.split(',');
        celdas[7] = '99';
        const primera = celdas.join(',');
        celdas[0] = codigo;
        await writeFile(fichero, primera + '\n' + celdas.join(',') + '\n');
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'rutas',
          estado: 'running',
        });
        expect(
          await service.importCatalog('rutas', fichero, job.id),
        ).toMatchObject({ processed: 0, inserted: 0, discarded: 2 });
        const muestras = await tx.orm.public.MuestraDescartadaEtl.where({
          ejecucionId: job.id,
        }).all();
        expect(muestras).toHaveLength(2);
        expect(
          muestras.every((m) =>
            m.motivo.includes(
              'misma clave de importación con códigos de aerolínea distintos',
            ),
          ),
        ).toBe(true);
      });
    },
  );

  it.each([
    ['origen', 2],
    ['destino', 4],
  ] as const)(
    'omite y audita el conflicto entre ID externo y código de %s',
    async (extremo, columna) => {
      await aislado(async (tx, service) => {
        const otro = await tx.orm.public.Aeropuerto.firstOrThrow({
          idOpenflights: 1,
        });
        const celdas = linea.split(',');
        celdas[columna] = otro.iata!;
        await writeFile(fichero, celdas.join(',') + '\n');
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'rutas',
          estado: 'running',
        });
        expect(
          await service.importCatalog('rutas', fichero, job.id),
        ).toMatchObject({ processed: 0, discarded: 1 });
        expect(
          await tx.orm.public.MuestraDescartadaEtl.first({
            ejecucionId: job.id,
          }),
        ).toMatchObject({
          campo: 'identidad',
          motivo: expect.stringContaining(
            `ambigua de ${extremo}: ID externo ${celdas[columna + 1]} y código ${otro.iata} identifican aeropuertos distintos`,
          ),
        });
      });
    },
  );

  it('acepta IATA e ICAO del mismo aeropuerto sin confundirlos con contradicciones', async () => {
    await aislado(async (tx, service) => {
      const celdas = linea.split(',');
      const origen = await tx.orm.public.Aeropuerto.firstOrThrow({
        idOpenflights: Number(celdas[3]),
      });
      expect(origen.icao).not.toBeNull();
      celdas[2] = origen.icao!;
      await writeFile(fichero, linea + '\n' + celdas.join(',') + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        processed: 2,
        inserted: 0,
        discarded: 0,
      });
    });
  });

  it('acepta el mismo aeropuerto de origen en ofertas con destinos diferentes', async () => {
    await aislado(async (tx, service) => {
      const otro = await tx.orm.public.Aeropuerto.firstOrThrow({
        idOpenflights: 1,
      });
      const celdas = linea.split(',');
      celdas[7] = '99';
      const primera = celdas.join(',');
      celdas[4] = otro.iata!;
      celdas[5] = String(otro.idOpenflights);
      await writeFile(fichero, primera + '\n' + celdas.join(',') + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        processed: 2,
        inserted: 2,
        discarded: 0,
      });
    });
  });

  it.each([
    ['origen', 2],
    ['destino', 4],
  ] as const)(
    'omite la misma clave con %s distinto al de una oferta de una carga anterior',
    async (extremo, columna) => {
      await aislado(async (tx, service) => {
        const otro = await tx.orm.public.Aeropuerto.firstOrThrow({
          idOpenflights: 1,
        });
        const celdas = linea.split(',');
        celdas[columna + 1] = '2147483002';
        celdas[7] = '99';
        await writeFile(fichero, celdas.join(',') + '\n');
        expect(await service.importCatalog('rutas', fichero)).toMatchObject({
          inserted: 1,
          discarded: 0,
        });
        celdas[columna] = otro.iata!;
        await writeFile(fichero, celdas.join(',') + '\n');
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'rutas',
          estado: 'running',
        });
        expect(
          await service.importCatalog('rutas', fichero, job.id),
        ).toMatchObject({ processed: 0, discarded: 1 });
        expect(
          await tx.orm.public.MuestraDescartadaEtl.first({
            ejecucionId: job.id,
          }),
        ).toMatchObject({
          motivo: expect.stringContaining(
            `${extremo} distinto a la oferta existente`,
          ),
        });
      });
    },
  );

  it.each([
    ['origen', 2],
    ['destino', 4],
  ] as const)(
    'omite dos filas del lote con el mismo ID externo desconocido y %s resuelto distinto',
    async (extremo, columna) => {
      await aislado(async (tx, service) => {
        const otro = await tx.orm.public.Aeropuerto.firstOrThrow({
          idOpenflights: 1,
        });
        const celdas = linea.split(',');
        celdas[columna + 1] = '2147483002';
        celdas[7] = '99';
        const primera = celdas.join(',');
        celdas[columna] = otro.iata!;
        await writeFile(fichero, primera + '\n' + celdas.join(',') + '\n');
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'rutas',
          estado: 'running',
        });
        expect(
          await service.importCatalog('rutas', fichero, job.id),
        ).toMatchObject({ processed: 0, inserted: 0, discarded: 2 });
        const muestras = await tx.orm.public.MuestraDescartadaEtl.where({
          ejecucionId: job.id,
        }).all();
        expect(muestras).toHaveLength(2);
        expect(
          muestras.every((m) =>
            m.motivo.includes(
              `ambigua de ${extremo}: ID externo 2147483002 se asocia a aeropuertos distintos en el lote`,
            ),
          ),
        ).toBe(true);
      });
    },
  );

  it('omite IDs de aeropuerto contradictorios aunque cambien las claves y el extremo donde aparecen', async () => {
    await aislado(async (tx, service) => {
      const otro = await tx.orm.public.Aeropuerto.firstOrThrow({
        idOpenflights: 1,
      });
      const primera = linea.split(',');
      primera[3] = '2147483002';
      primera[7] = '99';
      const segunda = linea.split(',');
      segunda[4] = otro.iata!;
      segunda[5] = '2147483002';
      segunda[7] = '98';
      await writeFile(
        fichero,
        primera.join(',') + '\n' + segunda.join(',') + '\n',
      );
      const job = await tx.orm.public.EjecucionEtl.create({
        fuente: 'rutas',
        estado: 'running',
      });
      expect(
        await service.importCatalog('rutas', fichero, job.id),
      ).toMatchObject({ processed: 0, inserted: 0, discarded: 2 });
      const muestras = await tx.orm.public.MuestraDescartadaEtl.where({
        ejecucionId: job.id,
      }).all();
      expect(muestras).toHaveLength(2);
      expect(
        muestras.every((m) =>
          m.motivo.includes(
            'ID externo 2147483002 se asocia a aeropuertos distintos en el lote',
          ),
        ),
      ).toBe(true);
      expect(muestras.map((m) => m.motivo)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('ambigua de origen'),
          expect.stringContaining('ambigua de destino'),
        ]),
      );
    });
  });

  it('audita una colisión en la ruta efectiva después de cambiar sus aeropuertos', async () => {
    await aislado(async (tx, service) => {
      const original = referencia();
      const [refs] = await resolveRouteBatch(tx, [original]);
      const oferta = await tx.orm.public.OfertaRuta.firstOrThrow({
        id: refs.ofertaId!,
      });
      await tx.orm.public.OfertaRuta.where({ id: oferta.id }).update({
        aerolineaId: null,
        protegidoManualmente: true,
      });
      await writeFile(fichero, linea + '\n');
      expect(await service.importCatalog('rutas', fichero)).toMatchObject({
        discarded: 0,
      });
      const aeropuerto = await tx.orm.public.Aeropuerto.create({
        nombre: 'Destino administrativo',
        nombrePais: 'Test',
        latitud: 1,
        longitud: 2,
      });
      await tx.orm.public.Ruta.where({ id: oferta.rutaId }).update({
        destinoId: aeropuerto.id,
        protegidoManualmente: true,
      });
      const manual = await tx.orm.public.OfertaRuta.create({
        rutaId: oferta.rutaId,
        aerolineaId: refs.aerolineaId,
        codigoAerolinea: String(original.codigoAerolinea),
        codigoCompartido: Boolean(original.codigoCompartido),
        escalas: Number(original.escalas),
        fuente: 'Administrativa',
      });
      await tx.orm.public.OfertaRuta.where({ id: oferta.id }).update({
        protegidoManualmente: false,
      });
      const job = await tx.orm.public.EjecucionEtl.create({
        fuente: 'rutas',
        estado: 'running',
      });
      expect(
        await service.importCatalog('rutas', fichero, job.id),
      ).toMatchObject({ processed: 0, discarded: 1 });
      expect(
        await tx.orm.public.MuestraDescartadaEtl.first({ ejecucionId: job.id }),
      ).toMatchObject({ campo: 'identidad' });
      expect(
        await tx.orm.public.OfertaRuta.first({ id: oferta.id }),
      ).toMatchObject({ aerolineaId: null, rutaId: oferta.rutaId });
      expect(
        await tx.orm.public.OfertaRuta.first({ id: manual.id }),
      ).not.toBeNull();
      expect(
        await tx.orm.public.Ruta.first({ id: oferta.rutaId }),
      ).toMatchObject({ destinoId: aeropuerto.id });
    });
  });
});
