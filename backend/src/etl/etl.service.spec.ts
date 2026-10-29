import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { EtlService } from './etl.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueueToken } from '@nestjs/bullmq';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PipelineConfiguration } from './interfaces/pipeline-configuration.js';
import { BadRequestException } from '@nestjs/common';

describe('EtlService', () => {
  let service: EtlService;
  let queueMock: {
    add: jest.Mock;
    getWaitingCount: jest.Mock;
    getActiveCount: jest.Mock;
    getCompletedCount: jest.Mock;
    getFailedCount: jest.Mock;
  };
  let prismaMock: {
    models: {
      EtlJob: ReturnType<typeof mockCollection>;
      Airport: ReturnType<typeof mockCollection>;
      Airline: ReturnType<typeof mockCollection>;
      Country: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
  };

  beforeEach(async () => {
    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(1),
      getCompletedCount: jest.fn().mockResolvedValue(5),
      getFailedCount: jest.fn().mockResolvedValue(0),
    };

    prismaMock = {
      models: {
        EtlJob: mockCollection(),
        Airport: mockCollection(),
        Airline: mockCollection(),
        Country: mockCollection(),
      },
      db: mockDatabase(),
    };
    prismaMock.models.EtlJob.create.mockResolvedValue({ id: 'job-record-1' });
    prismaMock.models.EtlJob.all.mockResolvedValue([
      { id: 'job-record-1', status: 'completed' },
    ]);
    prismaMock.models.Airport.createAndCount.mockResolvedValue(0);
    prismaMock.models.Airline.createAndCount.mockResolvedValue(0);
    prismaMock.models.Country.createAndCount.mockImplementation(
      (rows: unknown[]) => Promise.resolve(rows.length),
    );

    prismaMock.db.query.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlService,
        {
          provide: getQueueToken('etl-queue'),
          useValue: queueMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<EtlService>(EtlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each(['processAirports', 'processAirlines', 'processCountries'] as const)(
    '%s rejects unreadable files instead of leaving an unhandled stream error',
    async (method) => {
      await expect(
        service[method]('/missing/flywise-audit-file.dat'),
      ).rejects.toThrow(/ENOENT/);
    },
  );

  it('bounds country batches and counts actual inserts, including duplicates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-countries-'));
    try {
      const file = join(directory, 'countries.dat');
      await writeFile(
        file,
        Array.from({ length: 2001 }, (_, i) => `Country ${i},XX,XX`).join('\n'),
      );
      prismaMock.db.query
        .mockResolvedValueOnce(
          Array.from({ length: 2000 }, (_, i) => ({ inserted: i !== 0 })),
        )
        .mockResolvedValueOnce([{ inserted: true }]);
      await expect(service.processCountries(file)).resolves.toEqual({
        total: 2001,
        processed: 2001,
        inserted: 2000,
        discarded: 0,
      });
      expect(prismaMock.db.query).toHaveBeenCalledTimes(2);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it.each([
    [
      'processAirports',
      '1,Ezeiza,City,Argentina,EZE,SAEZ,-34,-58,0,0,N,UTC,airport,OpenFlights',
    ],
    ['processAirlines', '1,Airline,Alias,AR,ARG,Callsign,Argentina,Y'],
  ] as const)(
    '%s does not count duplicate rows as inserts',
    async (method, row) => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-duplicates-'));
      try {
        const file = join(directory, 'catalog.dat');
        await writeFile(file, row);
        await expect(service[method](file)).resolves.toEqual({
          total: 1,
          processed: 1,
          inserted: 0,
          discarded: 0,
        });
        expect(prismaMock.db.query).toHaveBeenCalledTimes(1);
      } finally {
        await rm(directory, { recursive: true });
      }
    },
  );

  it('discards out-of-range and non-finite coordinates before inserting a batch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-airports-'));
    try {
      const file = join(directory, 'airports.dat');
      await writeFile(
        file,
        [
          '1,Invalid,City,Argentina,EZE,SAEZ,91,-58,0,0,N,UTC,airport,OpenFlights',
          '2,Invalid,City,Argentina,EZE,SAEZ,-34,181,0,0,N,UTC,airport,OpenFlights',
          '3,Invalid,City,Argentina,EZE,SAEZ,Infinity,-58,0,0,N,UTC,airport,OpenFlights',
        ].join('\n'),
      );
      await expect(service.processAirports(file)).resolves.toEqual({
        total: 3,
        processed: 0,
        inserted: 0,
        discarded: 3,
      });
      expect(prismaMock.models.Airport.createAndCount).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  describe('Configured CSV mapping', () => {
    const configuration: PipelineConfiguration = {
      connection: {
        sourceType: 'http_stream',
        endpointUrl: 'https://raw.githubusercontent.com/catalog.csv',
        httpMethod: 'GET',
        dataFormat: 'csv',
        csvHasHeader: true,
        csvDelimiter: ';',
      },
      schemaMapping: [
        {
          sourceColumn: 'id',
          targetField: 'openflightsId',
          transform: 'to_number',
        },
        { sourceColumn: 'title', targetField: 'name', transform: 'uppercase' },
        {
          sourceColumn: 'lat',
          targetField: 'latitude',
          transform: 'to_number',
        },
        {
          sourceColumn: 'lng',
          targetField: 'longitude',
          transform: 'to_number',
        },
      ],
      scheduleConfig: {
        cronExpression: '',
        batchSize: 2000,
        timeoutSeconds: 300,
        maxRetries: 2,
      },
    };
    it.each([
      ['city', '   '],
      ['iata', 'INVALID'],
      ['countryName', ' \\N '],
    ])('discards a required %s that normalizes to absence or a fallback', async (field, value) => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-required-'));
      try {
        const file = join(directory, 'airports.csv');
        await writeFile(file, `id;title;lat;lng;extra\n42;Airport;0;0;${value}\n`);
        await expect(service.importCatalog('airports', file, undefined, {
          ...configuration,
          schemaMapping: [...configuration.schemaMapping, { sourceColumn: 'extra', targetField: field, required: true }],
        })).resolves.toMatchObject({ total: 1, processed: 0, discarded: 1 });
      } finally {
        await rm(directory, { recursive: true });
      }
    });
    it('uses native CSV quoting, header names and transformations without inventing optional codes', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-mapping-'));
      try {
        const file = join(directory, 'airports.csv');
        await writeFile(file, 'id;title;lat;lng\n2147480000;" a; b ";0;-58\n');
        prismaMock.db.query.mockResolvedValueOnce([{ inserted: true }]);
        await expect(
          service.importCatalog('airports', file, undefined, configuration),
        ).resolves.toEqual({
          total: 1,
          processed: 1,
          inserted: 1,
          discarded: 0,
        });
        const batch: unknown = JSON.parse(
          String(prismaMock.db.raw.sql.mock.calls[0][1]),
        );
        expect(batch).toMatchObject([
          {
            openflightsId: 2147480000,
            name: 'A; B',
            latitude: 0,
            longitude: -58,
            iata: null,
          },
        ]);
      } finally {
        await rm(directory, { recursive: true });
      }
    });
    it('fails a wrong mapping before writing or classifying all rows as discarded', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-mapping-'));
      try {
        const file = join(directory, 'airports.csv');
        await writeFile(file, 'wrong;columns\n1;2\n');
        await expect(
          service.importCatalog('airports', file, undefined, configuration),
        ).rejects.toThrow(/columnas/);
        expect(prismaMock.db.query).not.toHaveBeenCalled();
      } finally {
        await rm(directory, { recursive: true });
      }
    });
  });

  describe('triggerJob', () => {
    it('rejects unknown datasets before creating a job', async () => {
      await expect(service.triggerJob('unknown')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.models.EtlJob.create).not.toHaveBeenCalled();
    });

    it('marks the job failed if it cannot be queued', async () => {
      queueMock.add.mockRejectedValueOnce(new Error('Queue unavailable'));
      await expect(service.triggerJob('all')).rejects.toThrow(
        'Queue unavailable',
      );
      expect(prismaMock.models.EtlJob.update).toHaveBeenCalledWith({
        status: 'failed',
        errorMessage: 'Queue unavailable',
      });
    });
    it('should create database record and enqueue BullMQ job', async () => {
      const res = await service.triggerJob('airports');

      expect(prismaMock.models.EtlJob.create).toHaveBeenCalledWith({
        source: 'airports',
        status: 'pending',
      });
      expect(queueMock.add).toHaveBeenCalled();
      expect(res.jobId).toBe('job-record-1');
      expect(res.bullJobId).toBe('bull-job-1');
    });
  });

  describe('getStatus', () => {
    it('should return queue metrics', async () => {
      const res = await service.getStatus();
      expect(queueMock.getActiveCount).toHaveBeenCalled();
      expect(res.counts.active).toBe(1);
      expect(res.counts.completed).toBe(5);
    });
  });

  describe('getHistory', () => {
    it('derives duration from timestamps and leaves unfinished jobs without a duration', async () => {
      prismaMock.models.EtlJob.all.mockResolvedValue([
        {
          id: 'finished',
          startedAt: '2026-09-01 00:00:00',
          finishedAt: '2026-09-01 00:00:02',
        },
        { id: 'pending', startedAt: null, finishedAt: null },
      ]);
      const history = await service.getHistory();
      expect(history.map((job) => job.durationMs)).toEqual([2000, null]);
    });
    it('should return recent ETL jobs', async () => {
      const res = await service.getHistory();
      expect(prismaMock.models.EtlJob.all).toHaveBeenCalled();
      expect(res).toHaveLength(1);
    });
  });
});
