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
  connection: {
    sourceType: 'http_stream',
    endpointUrl: 'https://example.test/flights.csv',
    httpMethod: 'GET',
    dataFormat: 'csv',
    headers: [{ key: 'Authorization', credentialRef: 'BTS_API_TOKEN' }],
  },
  schemaMapping: [
    { sourceColumn: 'ORIGIN', targetField: 'originId', required: true },
  ],
  scheduleConfig: {
    cronExpression: '',
    batchSize: 2000,
    timeoutSeconds: 60,
    maxRetries: 3,
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
  it('queries route codes through airports and computes uncached distances in PostGIS', async () => {
    await isolated(async (tx) => {
      const origin = await tx.orm.public.Airport.create({
        name: 'EZE fixture',
        countryName: 'Argentina',
        iata: 'EZE',
        latitude: -34.8222,
        longitude: -58.5358,
      });
      const destination = await tx.orm.public.Airport.create({
        name: 'MIA fixture',
        countryName: 'United States',
        iata: 'MIA',
        latitude: 25.7959,
        longitude: -80.2906,
      });
      await tx.orm.public.Route.create({
        originId: origin.id,
        destinationId: destination.id,
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
          .findDirect({ origin: 'eze', destination: 'mia' });
        expect(route.origin.iata).toBe('EZE');
        expect(route.distanceKm).toBeGreaterThan(7000);
        expect(route.distanceKm).toBeLessThan(7200);
        expect(route.distanceNm).toBeCloseTo(route.distanceKm / 1.852, 0);
      } finally {
        await module.close();
      }
    });
  });
  it('links only unique normalized country names and preserves explicit links and labels', async () => {
    await isolated(async (tx) => {
      const prefix = randomUUID();
      const country = await tx.orm.public.Country.create({
        name: `${prefix} Unique`,
      });
      await tx.orm.public.Country.createAndCount([
        { name: `${prefix} Ambiguous` },
        { name: ` ${prefix} AMBIGUOUS ` },
      ]);
      const airports = await Promise.all(
        [`${prefix} UNIQUE `, `${prefix} ambiguous`, `${prefix} unknown`].map(
          (countryName) =>
            tx.orm.public.Airport.create({
              name: 'Test airport',
              countryName,
              latitude: 0,
              longitude: 0,
            }),
        ),
      );
      const airline = await tx.orm.public.Airline.create({
        name: prefix,
        country: ` ${prefix} unique`,
      });
      await linkCatalogCountries(tx);
      const linked = await tx.orm.public.Airport.where((row) =>
        row.id.in(airports.map((a) => a.id)),
      ).all();
      expect(linked.find((a) => a.id === airports[0].id)?.countryId).toBe(
        country.id,
      );
      expect(linked.filter((a) => a.countryId === null)).toHaveLength(2);
      expect(
        (await tx.orm.public.Airline.firstOrThrow({ id: airline.id }))
          .countryId,
      ).toBe(country.id);
      await tx.orm.public.Airport.where({ id: airports[2].id }).update({
        countryId: country.id,
      });
      await linkCatalogCountries(tx);
      expect(
        (await tx.orm.public.Airport.firstOrThrow({ id: airports[2].id }))
          .countryName,
      ).toBe(`${prefix} unknown`);
      expect(
        (await tx.orm.public.Airport.firstOrThrow({ id: airports[2].id }))
          .countryId,
      ).toBe(country.id);
      await rejected(
        tx,
        () => tx.orm.public.Country.where({ id: country.id }).delete(),
        /foreign key/i,
      );
    });
  });
  it('archives pipelines without losing execution configuration, samples or events', async () => {
    await isolated(async (tx) => {
      const user = await tx.orm.public.User.create({
        email: `${randomUUID()}@example.test`,
        passwordHash: 'fixture',
      });
      expect(user.role).toBe('OPERATOR');
      const pipeline = await tx.orm.public.EtlPipeline.create({
        name: 'BTS',
        datasetName: 'Flights',
        targetEntity: 'otp_metrics',
        ...configuration,
      });
      const job = await tx.orm.public.EtlJob.create({
        source: 'bts-transtats',
        status: 'pending',
        pipelineId: pipeline.id,
        requestedById: user.id,
        configurationSnapshot: configuration,
        sourceUri: 's3://flywise/flights.csv',
        sourceChecksum: 'a'.repeat(64),
      });
      await tx.orm.public.EtlDiscardedSample.create({
        jobId: job.id,
        rowIndex: 2,
        field: 'originId',
        reason: 'Unknown airport',
        rawSample: 'UNKNOWN',
      });
      await tx.orm.public.EtlJobEvent.create({
        jobId: job.id,
        level: 'warn',
        message: 'Discarded row 2',
      });
      await tx.orm.public.EtlPipeline.where({ id: pipeline.id }).update({
        archivedAt: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        schemaMapping: [],
      });
      const saved = await tx.orm.public.EtlJob.include('discardedSamples')
        .include('events')
        .firstOrThrow({ id: job.id });
      expect(saved.configurationSnapshot).toEqual(configuration);
      expect(saved.discardedSamples).toHaveLength(1);
      expect(saved.events).toHaveLength(1);
      await rejected(
        tx,
        () => tx.orm.public.EtlPipeline.where({ id: pipeline.id }).delete(),
        /foreign key/i,
      );
      await rejected(
        tx,
        () => tx.orm.public.EtlJob.where({ id: job.id }).delete(),
        /foreign key/i,
      );
      await tx.orm.public.User.where({ id: user.id }).delete();
      expect(
        (await tx.orm.public.EtlJob.firstOrThrow({ id: job.id })).requestedById,
      ).toBeNull();
    });
  });
  it('rejects unsafe connection storage, invalid scheduling and missing snapshots', async () => {
    await isolated(async (tx) => {
      const data = {
        name: 'Pipeline',
        datasetName: 'Flights',
        targetEntity: 'otp_metrics' as const,
        ...configuration,
      };
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlPipeline.create({
            ...data,
            connection: {
              ...configuration.connection,
              headers: [{ key: 'Authorization', value: 'secret' }],
            },
          }),
        /etl_pipelines_connection_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlPipeline.create({
            ...data,
            connection: {
              ...configuration.connection,
              endpointUrl: 'https://user:password@example.test/file',
            },
          }),
        /etl_pipelines_connection_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlPipeline.create({
            ...data,
            scheduleConfig: {
              ...configuration.scheduleConfig,
              batchSize: 999,
            },
          }),
        /etl_pipelines_schedule_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlPipeline.create({
            ...data,
            scheduleConfig: {
              ...configuration.scheduleConfig,
              maxRetries: -1,
            },
          }),
        /etl_pipelines_schedule_check/,
      );
      const pipeline = await tx.orm.public.EtlPipeline.create(data);
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlJob.create({
            source: 'BTS',
            status: 'pending',
            pipelineId: pipeline.id,
          }),
        /etl_jobs_snapshot_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlJob.create({
            source: 'BTS',
            status: 'pending',
            configurationSnapshot: { password: 'secret' },
          }),
        /etl_jobs_snapshot_check/,
      );
    });
  });
  it('bounds discarded samples and accepts legacy jobs without inferred provenance', async () => {
    await isolated(async (tx) => {
      const job = await tx.orm.public.EtlJob.create({
        source: 'all',
        status: 'pending',
      });
      expect(job.pipelineId).toBeNull();
      expect(job.configurationSnapshot).toBeNull();
      const sample = {
        jobId: job.id,
        rowIndex: 1,
        reason: 'Invalid row',
        rawSample: 'x',
      };
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlDiscardedSample.create({ ...sample, rowIndex: 0 }),
        /etl_discarded_samples_row_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlDiscardedSample.create({
            ...sample,
            rawSample: 'x'.repeat(4097),
          }),
        /too long|length/i,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.EtlJob.create({
            source: 'BTS',
            status: 'pending',
            sourceChecksum: 'invalid',
          }),
        /etl_jobs_checksum_check/,
      );
    });
  });
  it('keeps WGS 84 locations synchronized and rejects invalid coordinates', async () => {
    await isolated(async (tx) => {
      const airport = await tx.orm.public.Airport.create({
        name: 'EZE',
        countryName: 'Argentina',
        latitude: -34.8222,
        longitude: -58.5358,
      });
      await tx.orm.public.Airport.where({ id: airport.id }).update({
        longitude: -58,
      });
      const [location] = await tx.query(
        tx.raw.sql`
        SELECT ST_SRID(location::geometry) AS srid, ST_X(location::geometry) AS lng,
          ST_DWithin(location, ST_SetSRID(ST_MakePoint(-58, -34.8222), 4326)::geography, 1) AS nearby
        FROM airports WHERE id = ${airport.id}
      `
          .returnsRow({
            srid: 'pg/float8@1',
            lng: 'pg/float8@1',
            nearby: 'pg/bool@1',
          })
          .build(),
      );
      expect(location).toEqual({ srid: 4326, lng: -58, nearby: true });
      await rejected(
        tx,
        () =>
          tx.orm.public.Airport.where({ id: airport.id }).update({
            latitude: 91,
          }),
        /valid_airport_coordinates/,
      );
    });
  });
  it('preserves flight history, source identity and monthly aggregation semantics', async () => {
    await isolated(async (tx) => {
      const origin = await tx.orm.public.Airport.create({
        name: 'Origin',
        countryName: 'Test',
        latitude: 0,
        longitude: 0,
      });
      const destination = await tx.orm.public.Airport.create({
        name: 'Destination',
        countryName: 'Test',
        latitude: 1,
        longitude: 1,
      });
      const airline = await tx.orm.public.Airline.create({ name: 'Operator' });
      const tuple = {
        originId: origin.id,
        destinationId: destination.id,
        airlineId: airline.id,
      };
      const flight = {
        ...tuple,
        source: 'test',
        flightDate: '2026-09-01',
        flightNumber: '001',
      };
      await tx.orm.public.Flight.createAndCount([
        {
          ...flight,
          sourceRecordId: 'early',
          status: 'ARRIVED',
          arrivalDelayMinutes: -10,
        },
        {
          ...flight,
          sourceRecordId: 'boundary',
          status: 'ARRIVED',
          arrivalDelayMinutes: 15,
        },
        {
          ...flight,
          sourceRecordId: 'late',
          status: 'ARRIVED',
          arrivalDelayMinutes: 16,
        },
        { ...flight, sourceRecordId: 'cancelled', status: 'CANCELLED' },
        { ...flight, sourceRecordId: 'diverted', status: 'DIVERTED' },
      ]);
      await rejected(
        tx,
        () =>
          tx.orm.public.Flight.create({
            ...flight,
            sourceRecordId: 'early',
            status: 'ARRIVED',
            arrivalDelayMinutes: 0,
          }),
        /unique constraint/i,
      );
      await rejected(
        tx,
        () => tx.orm.public.Airport.where({ id: origin.id }).delete(),
        /foreign key/i,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.Flight.create({
            ...flight,
            sourceRecordId: 'unknown',
            status: 'ARRIVED',
          }),
        /flights_arrival_delay_check/,
      );
      const [result] = await tx.query(
        tx.raw.sql`
        SELECT (100.0 * count(*) FILTER (WHERE status = 'ARRIVED' AND arrival_delay_minutes <= 15)
          / NULLIF(count(*) FILTER (WHERE status <> 'CANCELLED'), 0))::float8 AS otp,
          avg(arrival_delay_minutes)::float8 AS mean FROM flights WHERE origin_id = ${origin.id}
      `
          .returnsRow({
            otp: 'pg/float8@1',
            mean: 'pg/float8@1',
          })
          .build(),
      );
      expect(result.otp).toBe(50);
      expect(result.mean).toBe(7);
      const metric = await tx.orm.public.RouteMetric.create({
        ...tuple,
        period: '2026-09-01',
        totalFlights: 5,
        cancelledFlights: 1,
        divertedFlights: 1,
        onTimeFlights: 2,
        totalArrivalDelayMinutes: 21n,
      });
      await rejected(
        tx,
        () =>
          tx.orm.public.RouteMetric.create({
            ...tuple,
            period: metric.period,
            totalFlights: 1,
          }),
        /unique constraint/i,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.RouteMetric.where({
            ...tuple,
            period: metric.period,
          }).update({ period: '2026-09-02' }),
        /route_metrics_period_check/,
      );
      await rejected(
        tx,
        () =>
          tx.orm.public.RouteMetric.where({
            ...tuple,
            period: metric.period,
          }).update({ onTimeFlights: 4 }),
        /route_metrics_counts_check/,
      );
      await tx.orm.public.RouteMetric.create({
        ...tuple,
        period: '2026-10-01',
        totalFlights: 100,
        onTimeFlights: 100,
      });
      const [combined] = await tx.query(
        tx.raw.sql`
        SELECT (100.0 * sum(on_time_flights) / NULLIF(sum(total_flights - cancelled_flights), 0))::float8 AS otp
        FROM route_metrics WHERE origin_id = ${origin.id}
      `
          .returnsRow({
            otp: 'pg/float8@1',
          })
          .build(),
      );
      expect(combined.otp).toBeCloseTo((100 * 102) / 104);
      await tx.orm.public.RouteMetric.where({
        ...tuple,
        period: metric.period,
      }).update({
        totalFlights: 1,
        cancelledFlights: 1,
        divertedFlights: 0,
        onTimeFlights: 0,
        totalArrivalDelayMinutes: 0n,
      });
      const [empty] = await tx.query(
        tx.raw.sql`
        SELECT (100.0 * on_time_flights / NULLIF(total_flights - cancelled_flights, 0))::float8 AS otp
        FROM route_metrics WHERE origin_id = ${tuple.originId} AND period = ${metric.period}::date
      `
          .returnsRow({
            otp: { codecId: 'pg/float8@1', nullable: true },
          })
          .build(),
      );
      expect(empty.otp).toBeNull();
    });
  });

  it('combines airport and airline filters in the database', async () => {
    await isolated(async (tx) => {
      const airports = [0, 1, 2].map((index) => ({
        id: randomUUID(),
        name: 'Audit airport',
        countryName: 'Audit',
        iata: `QX${String.fromCharCode(65 + index)}`,
        latitude: index,
        longitude: index,
      }));
      await tx.orm.public.Airport.createAndCount(airports);
      const airline = 'Z1';
      const routes = [
        {
          id: randomUUID(),
          originId: airports[0].id,
          destinationId: airports[1].id,
          airlineCode: airline,
        },
        {
          id: randomUUID(),
          originId: airports[0].id,
          destinationId: airports[1].id,
          airlineCode: 'Z2',
        },
        {
          id: randomUUID(),
          originId: airports[2].id,
          destinationId: airports[1].id,
          airlineCode: airline,
        },
      ];
      await tx.orm.public.Route.createAndCount(routes);
      const module = await services(tx);
      try {
        const found = await module
          .get(RoutesService)
          .explore({ originId: airports[0].id, origin: 'qxa', airline });
        expect(found.map((route) => route.id)).toEqual([routes[0].id]);
      } finally {
        await module.close();
      }
    });
  });

  it('paginates airlines with offset, active-first ordering and literal search characters', async () => {
    await isolated(async (tx) => {
      const prefix = `Audit_%${randomUUID()}`;
      await tx.orm.public.Airline.createAndCount([
        { name: `${prefix} A`, active: false },
        { name: `${prefix} B`, active: true },
        { name: `${prefix} C`, active: true },
      ]);
      const module = await services(tx);
      try {
        const service = module.get(AirlinesService);
        const first = await service.findAll({ q: prefix, page: 1, limit: 1 });
        const second = await service.findAll({ q: prefix, page: 2, limit: 1 });
        const last = await service.findAll({ q: prefix, page: 3, limit: 1 });
        expect([
          first.data[0].name,
          second.data[0].name,
          last.data[0].name,
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

  it('selects public user fields and persists role changes', async () => {
    await isolated(async (tx) => {
      const user = await tx.orm.public.User.create({
        email: `${randomUUID()}@example.test`,
        passwordHash: 'private',
        role: 'OPERATOR',
      });
      const module = await services(tx);
      try {
        const service = module.get(UsersService);
        const profile = await service.getUserById(user.id);
        expect(profile).not.toHaveProperty('passwordHash');
        expect(profile).not.toHaveProperty('updatedAt');
        expect(profile.createdAt).toBeInstanceOf(Date);
        expect(profile.role).toBe('OPERATOR');
        await service.updateUser(user.id, { role: 'ADMIN' });
        expect((await service.getUserById(user.id)).role).toBe('ADMIN');
      } finally {
        await module.close();
      }
    });
  });
});
