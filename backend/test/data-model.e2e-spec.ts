import { crearOfertaFixture } from './helpers/oferta-fixture.js';
import { AirlinesService } from '../src/airlines/airlines.service.js';
import { UsersService } from '../src/users/users.service.js';
import 'dotenv/config';
import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { randomUUID } from 'node:crypto';
import { linkCatalogCountries } from '../src/prisma/link-catalog-countries.js';
import type { PipelineConfiguration } from '../src/etl/interfaces/pipeline-configuration.js';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RoutesService } from '../src/routes/routes.service.js';
const configuration: PipelineConfiguration = {
  conexion: {
    tipoFuente: 'http_stream',
    urlEndpoint: 'https://example.test/vuelos.csv',
    metodoHttp: 'GET',
    formatoDatos: 'csv',
    headers: [{ key: 'Authorization', referenciaCredencial: 'BTS_API_TOKEN' }],
  },
  mapeoEsquema: [
    { columnaOrigen: 'ORIGIN', campoDestino: 'origenId', required: true },
  ],
  configuracionProgramacion: {
    expresionCron: '',
    tamanoLote: 2000,
    tiempoLimiteSegundos: 60,
    maximoReintentos: 3,
  },
};
describe('Data model (PostgreSQL integration)', () => {
  const prisma = createDatabase();
  const rollback = new Error('rollback test fixtures');
  async function services(tx: Transaction) {
    return Test.createTestingModule({
      providers: [
        RoutesService,
        AirlinesService,
        UsersService,
        { provide: PrismaService, useValue: { models: tx.orm.public, db: tx } },
      ],
    }).compile();
  }

  async function isolated(work: (tx: Transaction) => Promise<void>) {
    try {
      await prisma.transaction(async (tx) => {
        await work(tx);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  async function rejected(
    tx: Transaction,
    work: () => Promise<unknown>,
    message: RegExp,
  ) {
    await tx.execute(
      tx.raw.sql`SAVEPOINT invalid_write`.affectedCount().build(),
    );
    await expect(work()).rejects.toThrow(message);
    await tx.execute(
      tx.raw.sql`ROLLBACK TO SAVEPOINT invalid_write`.affectedCount().build(),
    );
    await tx.execute(
      tx.raw.sql`RELEASE SAVEPOINT invalid_write`.affectedCount().build(),
    );
  }
  afterAll(async () => {
    await prisma.close();
  });
  it('queries route codes through aeropuertos and computes uncached distances in PostGIS', async () => {
    await isolated(async (tx) => {
      const origen = await tx.orm.public.Aeropuerto.create({
        nombre: 'EZE fixture',
        nombrePais: 'Argentina',
        iata: 'QZA',
        latitud: -34.8222,
        longitud: -58.5358,
      });
      const destino = await tx.orm.public.Aeropuerto.create({
        nombre: 'MIA fixture',
        nombrePais: 'United States',
        iata: 'QZB',
        latitud: 25.7959,
        longitud: -80.2906,
      });
      await crearOfertaFixture(tx, {
        origenId: origen.id,
        destinoId: destino.id,
      });
      const module = await Test.createTestingModule({
        providers: [
          RoutesService,
          {
            provide: PrismaService,
            useValue: { models: tx.orm.public, db: tx },
          },
        ],
      }).compile();
      try {
        const route = await module
          .get(RoutesService)
          .findDirect({ origen: 'qza', destino: 'qzb' });
        expect(route.origen.iata).toBe('QZA');
        expect(route.distanciaKm).toBeGreaterThan(7000);
        expect(route.distanciaKm).toBeLessThan(7200);
        expect(route.distanciaNm).toBeCloseTo(route.distanciaKm / 1.852, 0);
      } finally {
        await module.close();
      }
    });
  });
  it('links only unique normalized pais names and preserves explicit links and labels', async () => {
    await isolated(async (tx) => {
      const prefix = randomUUID();
      const pais = await tx.orm.public.Pais.create({
        nombre: `${prefix} Unique`,
      });
      await tx.orm.public.Pais.createAndCount([
        { nombre: `${prefix} Ambiguous` },
        { nombre: ` ${prefix} AMBIGUOUS ` },
      ]);
      const aeropuertos = await Promise.all(
        [`${prefix} UNIQUE `, `${prefix} ambiguous`, `${prefix} unknown`].map(
          (nombrePais) =>
            tx.orm.public.Aeropuerto.create({
              nombre: 'Test airport',
              nombrePais,
              latitud: 0,
              longitud: 0,
            }),
        ),
      );
      const aerolinea = await tx.orm.public.Aerolinea.create({
        nombre: prefix,
        pais: ` ${prefix} unique`,
      });
      await linkCatalogCountries(tx);
      const linked = await tx.orm.public.Aeropuerto.where((row) =>
        row.id.in(aeropuertos.map((a) => a.id)),
      ).all();
      expect(linked.find((a) => a.id === aeropuertos[0].id)?.paisId).toBe(
        pais.id,
      );
      expect(linked.filter((a) => a.paisId === null)).toHaveLength(2);
      expect(
        (await tx.orm.public.Aerolinea.firstOrThrow({ id: aerolinea.id }))
          .paisId,
      ).toBe(pais.id);
      await tx.orm.public.Aeropuerto.where({ id: aeropuertos[2].id }).update({
        paisId: pais.id,
      });
      await linkCatalogCountries(tx);
      expect(
        (await tx.orm.public.Aeropuerto.firstOrThrow({ id: aeropuertos[2].id }))
          .nombrePais,
      ).toBe(`${prefix} unknown`);
      expect(
        (await tx.orm.public.Aeropuerto.firstOrThrow({ id: aeropuertos[2].id }))
          .paisId,
      ).toBe(pais.id);
      await rejected(
        tx,
        () => tx.orm.public.Pais.where({ id: pais.id }).delete(),
        /foreign key/i,
      );
    });
  });
  it('archives pipelines without losing execution configuration, samples or eventos', async () => {
    await isolated(async (tx) => {
      const user = await tx.orm.public.Usuario.create({
        correo: `${randomUUID()}@example.test`,
        hashContrasena: 'fixture',
      });
      expect(user.rol).toBe('OPERATOR');
      const proceso = await tx.orm.public.ProcesoEtl.create({
        nombre: 'BTS',
        nombreConjunto: 'Flights',
        entidadDestino: 'otp_metrics',
        ...configuration,
      });
      const job = await tx.orm.public.EjecucionEtl.create({
        fuente: 'bts-transtats',
        estado: 'pending',
        procesoId: proceso.id,
        solicitanteId: user.id,
        instantaneaConfiguracion: configuration,
        uriFuente: 's3://flywise/vuelos.csv',
        checksumFuente: 'a'.repeat(64),
      });
      await tx.orm.public.MuestraDescartadaEtl.create({
        ejecucionId: job.id,
        numeroFila: 2,
        campo: 'origenId',
        motivo: 'Unknown airport',
        muestraOriginal: 'UNKNOWN',
      });
      await tx.orm.public.EventoEjecucionEtl.create({
        ejecucionId: job.id,
        nivel: 'warn',
        mensaje: 'Discarded row 2',
      });
      await tx.orm.public.ProcesoEtl.where({ id: proceso.id }).update({
        archivadoEn: new Date()
          .toISOString()
          .replace('T', ' ')
          .replace('Z', ''),
        mapeoEsquema: [],
      });
      const saved = await tx.orm.public.EjecucionEtl.include(
        'muestrasDescartadas',
      )
        .include('eventos')
        .firstOrThrow({ id: job.id });
      expect(saved.instantaneaConfiguracion).toEqual(configuration);
      expect(saved.muestrasDescartadas).toHaveLength(1);
      expect(saved.eventos).toHaveLength(1);
      await rejected(
        tx,
        () => tx.orm.public.ProcesoEtl.where({ id: proceso.id }).delete(),
        /foreign key/i,
      );
      await rejected(
        tx,
        () => tx.orm.public.EjecucionEtl.where({ id: job.id }).delete(),
        /foreign key/i,
      );
      await tx.orm.public.Usuario.where({ id: user.id }).delete();
      expect(
        (await tx.orm.public.EjecucionEtl.firstOrThrow({ id: job.id }))
          .solicitanteId,
      ).toBeNull();
    });
  });
  it('rejects unsafe conexion storage, invalid scheduling and missing snapshots', async () => {
    await isolated(async (tx) => {
      const data = {
        nombre: 'Pipeline',
        nombreConjunto: 'Flights',
        entidadDestino: 'otp_metrics' as const,
        ...configuration,
      };
      await rejected(
        tx,
        () =>
          tx.orm.public.ProcesoEtl.create({
            ...data,
            conexion: {
              ...configuration.conexion,
              headers: [{ key: 'Authorization', value: 'secret' }],
            },
          }),
        /etl_pipelines_connection_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.ProcesoEtl.create({
            ...data,
            conexion: {
              ...configuration.conexion,
              urlEndpoint: 'https://user:password@example.test/file',
            },
          }),
        /etl_pipelines_connection_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.ProcesoEtl.create({
            ...data,
            configuracionProgramacion: {
              ...configuration.configuracionProgramacion,
              tamanoLote: 999,
            },
          }),
        /etl_pipelines_schedule_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.ProcesoEtl.create({
            ...data,
            configuracionProgramacion: {
              ...configuration.configuracionProgramacion,
              maximoReintentos: -1,
            },
          }),
        /etl_pipelines_schedule_check/,
      );
      const proceso = await tx.orm.public.ProcesoEtl.create(data);
      await rejected(
        tx,
        () =>
          tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
            procesoId: proceso.id,
          }),
        /etl_jobs_snapshot_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
            instantaneaConfiguracion: { password: 'secret' },
          }),
        /etl_jobs_snapshot_check/,
      );
    });
  });
  it('bounds discarded samples and accepts legacy ejecuciones without inferred provenance', async () => {
    await isolated(async (tx) => {
      const job = await tx.orm.public.EjecucionEtl.create({
        fuente: 'all',
        estado: 'pending',
      });
      expect(job.procesoId).toBeNull();
      expect(job.instantaneaConfiguracion).toBeNull();
      const sample = {
        ejecucionId: job.id,
        numeroFila: 1,
        motivo: 'Invalid row',
        muestraOriginal: 'x',
      };
      await rejected(
        tx,
        () =>
          tx.orm.public.MuestraDescartadaEtl.create({
            ...sample,
            numeroFila: 0,
          }),
        /etl_discarded_samples_row_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.MuestraDescartadaEtl.create({
            ...sample,
            muestraOriginal: 'x'.repeat(4097),
          }),
        /too long|length/i,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
            checksumFuente: 'invalid',
          }),
        /etl_jobs_checksum_check/,
      );
    });
  });
  it('keeps WGS 84 locations synchronized and rejects invalid coordenadas', async () => {
    await isolated(async (tx) => {
      const airport = await tx.orm.public.Aeropuerto.create({
        nombre: 'EZE',
        nombrePais: 'Argentina',
        latitud: -34.8222,
        longitud: -58.5358,
      });
      await tx.orm.public.Aeropuerto.where({ id: airport.id }).update({
        longitud: -58,
      });
      const [ubicacion] = await tx.query(
        tx.raw.sql`
        SELECT ST_SRID(ubicacion::geometry) AS srid, ST_X(ubicacion::geometry) AS lng,
          ST_DWithin(ubicacion, ST_SetSRID(ST_MakePoint(-58, -34.8222), 4326)::geography, 1) AS nearby
        FROM aeropuertos WHERE id = ${airport.id}
      `
          .returnsRow({
            srid: 'pg/float8@1',
            lng: 'pg/float8@1',
            nearby: 'pg/bool@1',
          })
          .build(),
      );
      expect(ubicacion).toEqual({ srid: 4326, lng: -58, nearby: true });
      await rejected(
        tx,
        () =>
          tx.orm.public.Aeropuerto.where({ id: airport.id }).update({
            latitud: 91,
          }),
        /valid_airport_coordinates/,
      );
    });
  });
  it('preserves flight history, fuente identity and monthly aggregation semantics', async () => {
    await isolated(async (tx) => {
      const origen = await tx.orm.public.Aeropuerto.create({
        nombre: 'Origin',
        nombrePais: 'Test',
        latitud: 0,
        longitud: 0,
      });
      const destino = await tx.orm.public.Aeropuerto.create({
        nombre: 'Destination',
        nombrePais: 'Test',
        latitud: 1,
        longitud: 1,
      });
      const aerolinea = await tx.orm.public.Aerolinea.create({
        nombre: 'Operator',
      });
      const ejecucion = await tx.orm.public.EjecucionEtl.create({
        fuente: 'test',
        estado: 'running',
      });
      const tuple = {
        origenId: origen.id,
        destinoId: destino.id,
        aerolineaId: aerolinea.id,
      };
      const flight = {
        ...tuple,
        ejecucionEtlId: ejecucion.id,
        fuente: 'test',
        fechaVuelo: '2026-09-01',
        numeroVuelo: '001',
      };
      await tx.orm.public.Vuelo.createAndCount([
        {
          ...flight,
          idRegistroFuente: 'early',
          estado: 'ARRIVED',
          demoraLlegadaMinutos: -10,
        },
        {
          ...flight,
          idRegistroFuente: 'boundary',
          estado: 'ARRIVED',
          demoraLlegadaMinutos: 15,
        },
        {
          ...flight,
          idRegistroFuente: 'late',
          estado: 'ARRIVED',
          demoraLlegadaMinutos: 16,
        },
        { ...flight, idRegistroFuente: 'cancelled', estado: 'CANCELLED' },
        { ...flight, idRegistroFuente: 'diverted', estado: 'DIVERTED' },
      ]);
      await rejected(
        tx,
        () =>
          tx.orm.public.Vuelo.create({
            ...flight,
            idRegistroFuente: 'early',
            estado: 'ARRIVED',
            demoraLlegadaMinutos: 0,
          }),
        /unique constraint/i,
      );
      await rejected(
        tx,
        () => tx.orm.public.Aeropuerto.where({ id: origen.id }).delete(),
        /foreign key/i,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.Vuelo.create({
            ...flight,
            idRegistroFuente: 'unknown',
            estado: 'ARRIVED',
          }),
        /flights_arrival_delay_check/,
      );
      await rejected(
        tx,
        () => tx.orm.public.EjecucionEtl.where({ id: ejecucion.id }).delete(),
        /foreign key/i,
      );
      await rejected(
        tx,
        () =>
          tx.execute(
            tx.raw
              .sql`UPDATE vuelos SET ejecucion_etl_id=NULL WHERE origen_id=${origen.id}`
              .affectedCount()
              .build(),
          ),
        /not-null|null value/i,
      );
      const [result] = await tx.query(
        tx.raw.sql`
        SELECT (100.0 * count(*) FILTER (WHERE estado = 'ARRIVED' AND demora_llegada_minutos <= 15)
          / NULLIF(count(*) FILTER (WHERE estado <> 'CANCELLED'), 0))::float8 AS otp,
          avg(demora_llegada_minutos)::float8 AS mean FROM vuelos WHERE origen_id = ${origen.id}
      `
          .returnsRow({
            otp: 'pg/float8@1',
            mean: 'pg/float8@1',
          })
          .build(),
      );
      expect(result.otp).toBe(50);
      expect(result.mean).toBe(7);
      const metric = await tx.orm.public.MetricaRuta.create({
        ejecucionEtlId: ejecucion.id,
        ...tuple,
        periodo: '2026-09-01',
        vuelosTotales: 5,
        vuelosCancelados: 1,
        vuelosDesviados: 1,
        vuelosPuntuales: 2,
        demoraLlegadaTotalMinutos: 21n,
      });
      await rejected(
        tx,
        () =>
          tx.orm.public.MetricaRuta.create({
            ejecucionEtlId: ejecucion.id,
            ...tuple,
            periodo: metric.periodo,
            vuelosTotales: 1,
          }),
        /unique constraint/i,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.MetricaRuta.where({
            ...tuple,
            periodo: metric.periodo,
          }).update({ periodo: '2026-09-02' }),
        /route_metrics_period_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.MetricaRuta.where({
            ...tuple,
            periodo: metric.periodo,
          }).update({ vuelosPuntuales: 4 }),
        /route_metrics_counts_check/,
      );
      await tx.orm.public.MetricaRuta.create({
        ejecucionEtlId: ejecucion.id,
        ...tuple,
        periodo: '2026-10-01',
        vuelosTotales: 100,
        vuelosPuntuales: 100,
      });
      expect(metric.ejecucionEtlId).toBe(ejecucion.id);
      await rejected(
        tx,
        () =>
          tx.execute(
            tx.raw
              .sql`UPDATE metricas_ruta SET ejecucion_etl_id=NULL WHERE origen_id=${origen.id}`
              .affectedCount()
              .build(),
          ),
        /not-null|null value/i,
      );
      const [combined] = await tx.query(
        tx.raw.sql`
        SELECT (100.0 * sum(vuelos_puntuales) / NULLIF(sum(vuelos_totales - vuelos_cancelados), 0))::float8 AS otp
        FROM metricas_ruta WHERE origen_id = ${origen.id}
      `
          .returnsRow({
            otp: 'pg/float8@1',
          })
          .build(),
      );
      expect(combined.otp).toBeCloseTo((100 * 102) / 104);
      await tx.orm.public.MetricaRuta.where({
        ...tuple,
        periodo: metric.periodo,
      }).update({
        vuelosTotales: 1,
        vuelosCancelados: 1,
        vuelosDesviados: 0,
        vuelosPuntuales: 0,
        demoraLlegadaTotalMinutos: 0n,
      });
      const [empty] = await tx.query(
        tx.raw.sql`
        SELECT (100.0 * vuelos_puntuales / NULLIF(vuelos_totales - vuelos_cancelados, 0))::float8 AS otp
        FROM metricas_ruta WHERE origen_id = ${tuple.origenId} AND periodo = ${metric.periodo}::date
      `
          .returnsRow({
            otp: { codecId: 'pg/float8@1', nullable: true },
          })
          .build(),
      );
      expect(empty.otp).toBeNull();
    });
  });

  it('combines airport and aerolinea filters in the database', async () => {
    await isolated(async (tx) => {
      const aeropuertos = [0, 1, 2].map((index) => ({
        id: randomUUID(),
        nombre: 'Audit airport',
        nombrePais: 'Audit',
        iata: `QX${String.fromCharCode(65 + index)}`,
        latitud: index,
        longitud: index,
      }));
      await tx.orm.public.Aeropuerto.createAndCount(aeropuertos);
      const aerolinea = 'Z1';
      const rutas = [
        {
          id: randomUUID(),
          origenId: aeropuertos[0].id,
          destinoId: aeropuertos[1].id,
          codigoAerolinea: aerolinea,
        },
        {
          id: randomUUID(),
          origenId: aeropuertos[0].id,
          destinoId: aeropuertos[1].id,
          codigoAerolinea: 'Z2',
        },
        {
          id: randomUUID(),
          origenId: aeropuertos[2].id,
          destinoId: aeropuertos[1].id,
          codigoAerolinea: aerolinea,
        },
      ];
      for (const ruta of rutas) await crearOfertaFixture(tx, ruta);
      const module = await services(tx);
      try {
        const found = await module
          .get(RoutesService)
          .explore({ origenId: aeropuertos[0].id, origen: 'qxa', aerolinea });
        expect(found.map((route) => route.id)).toEqual([rutas[0].id]);
      } finally {
        await module.close();
      }
    });
  });

  it('paginates aerolineas with offset, activa-first ordering and literal search characters', async () => {
    await isolated(async (tx) => {
      const prefix = `Audit_%${randomUUID()}`;
      await tx.orm.public.Aerolinea.createAndCount([
        { nombre: `${prefix} A`, activa: false },
        { nombre: `${prefix} B`, activa: true },
        { nombre: `${prefix} C`, activa: true },
      ]);
      const module = await services(tx);
      try {
        const service = module.get(AirlinesService);
        const first = await service.findAll({ q: prefix, page: 1, limit: 1 });
        const second = await service.findAll({ q: prefix, page: 2, limit: 1 });
        const last = await service.findAll({ q: prefix, page: 3, limit: 1 });
        expect([
          first.data[0].nombre,
          second.data[0].nombre,
          last.data[0].nombre,
        ]).toEqual([`${prefix} B`, `${prefix} C`, `${prefix} A`]);
        expect(second.pagination).toEqual({
          page: 2,
          limit: 1,
          totalItems: 3,
          totalPages: 3,
        });
      } finally {
        await module.close();
      }
    });
  });

  it('selects public user fields and persists rol changes', async () => {
    await isolated(async (tx) => {
      const user = await tx.orm.public.Usuario.create({
        correo: `${randomUUID()}@example.test`,
        hashContrasena: 'private',
        rol: 'OPERATOR',
      });
      const module = await services(tx);
      try {
        const service = module.get(UsersService);
        const profile = await service.getUserById(user.id);
        expect(profile).not.toHaveProperty('hashContrasena');
        expect(profile).not.toHaveProperty('actualizadoEn');
        expect(profile.creadoEn).toBeInstanceOf(Date);
        expect(profile.rol).toBe('OPERATOR');
        await service.updateUser(user.id, { rol: 'ADMIN' });
        expect((await service.getUserById(user.id)).rol).toBe('ADMIN');
      } finally {
        await module.close();
      }
    });
  });
});
