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
      EjecucionEtl: ReturnType<typeof mockCollection>;
      Aeropuerto: ReturnType<typeof mockCollection>;
      Aerolinea: ReturnType<typeof mockCollection>;
      Pais: ReturnType<typeof mockCollection>;
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
        EjecucionEtl: mockCollection(),
        Aeropuerto: mockCollection(),
        Aerolinea: mockCollection(),
        Pais: mockCollection(),
      },
      db: mockDatabase(),
    };
    prismaMock.models.EjecucionEtl.create.mockResolvedValue({
      id: 'job-record-1',
    });
    prismaMock.models.EjecucionEtl.all.mockResolvedValue([
      { id: 'job-record-1', estado: 'completed' },
    ]);
    prismaMock.models.Aeropuerto.createAndCount.mockResolvedValue(0);
    prismaMock.models.Aerolinea.createAndCount.mockResolvedValue(0);
    prismaMock.models.Pais.createAndCount.mockImplementation(
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

  it('bounds pais batches and counts actual inserts, including duplicates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-paises-'));
    try {
      const file = join(directory, 'countries.dat');
      await writeFile(
        file,
        Array.from({ length: 2001 }, (_, i) => `Pais ${i},XX,XX`).join('\n'),
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
    ['processAirlines', '1,Aerolinea,Alias,AR,ARG,Callsign,Argentina,Y'],
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

  it('discards out-of-range and non-finite coordenadas before inserting a batch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-aeropuertos-'));
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
      expect(
        prismaMock.models.Aeropuerto.createAndCount,
      ).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  describe('Configured CSV mapping', () => {
    const configuration: PipelineConfiguration = {
      conexion: {
        tipoFuente: 'http_stream',
        urlEndpoint: 'https://raw.githubusercontent.com/catalog.csv',
        metodoHttp: 'GET',
        formatoDatos: 'csv',
        csvConCabecera: true,
        separadorCsv: ';',
      },
      mapeoEsquema: [
        {
          columnaOrigen: 'id',
          campoDestino: 'idOpenflights',
          transform: 'to_number',
        },
        {
          columnaOrigen: 'title',
          campoDestino: 'nombre',
          transform: 'uppercase',
        },
        {
          columnaOrigen: 'lat',
          campoDestino: 'latitud',
          transform: 'to_number',
        },
        {
          columnaOrigen: 'lng',
          campoDestino: 'longitud',
          transform: 'to_number',
        },
      ],
      configuracionProgramacion: {
        expresionCron: '',
        tamanoLote: 2000,
        tiempoLimiteSegundos: 300,
        maximoReintentos: 2,
      },
    };
    it.each([
      ['ciudad', '   '],
      ['iata', 'INVALID'],
      ['nombrePais', ' \\N '],
    ])(
      'discards a required %s that normalizes to absence or a fallback',
      async (campo, value) => {
        const directory = await mkdtemp(join(tmpdir(), 'flywise-required-'));
        try {
          const file = join(directory, 'aeropuertos.csv');
          await writeFile(
            file,
            `id;title;lat;lng;extra\n42;Aeropuerto;0;0;${value}\n`,
          );
          await expect(
            service.importCatalog('aeropuertos', file, undefined, {
              ...configuration,
              mapeoEsquema: [
                ...configuration.mapeoEsquema,
                { columnaOrigen: 'extra', campoDestino: campo, required: true },
              ],
            }),
          ).resolves.toMatchObject({ total: 1, processed: 0, discarded: 1 });
        } finally {
          await rm(directory, { recursive: true });
        }
      },
    );
    it.each(['abc', 'Infinity'])(
      'discards non-finite numeric conversions before they can become a code: %s',
      async (value) => {
        const directory = await mkdtemp(
          join(tmpdir(), 'flywise-numeric-code-'),
        );
        try {
          const file = join(directory, 'aeropuertos.csv');
          await writeFile(
            file,
            `id;title;lat;lng;code\n42;Aeropuerto;0;0;${value}\n`,
          );
          await expect(
            service.importCatalog('aeropuertos', file, undefined, {
              ...configuration,
              mapeoEsquema: [
                ...configuration.mapeoEsquema,
                {
                  columnaOrigen: 'code',
                  campoDestino: 'iata',
                  transform: 'to_number',
                  required: true,
                },
              ],
            }),
          ).resolves.toMatchObject({ processed: 0, discarded: 1 });
        } finally {
          await rm(directory, { recursive: true });
        }
      },
    );
    it('uses native CSV quoting, header names and transformations without inventing optional codes', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-mapping-'));
      try {
        const file = join(directory, 'aeropuertos.csv');
        await writeFile(file, 'id;title;lat;lng\n2147480000;" a; b ";0;-58\n');
        prismaMock.db.query.mockResolvedValueOnce([{ inserted: true }]);
        await expect(
          service.importCatalog('aeropuertos', file, undefined, configuration),
        ).resolves.toEqual({
          total: 1,
          processed: 1,
          inserted: 1,
          discarded: 0,
        });
        const batch: unknown = JSON.parse(
          String(
            prismaMock.db.raw.sql.mock.calls.find(
              ([, value]) => typeof value === 'string' && value.startsWith('['),
            )?.[1],
          ),
        );
        expect(batch).toMatchObject([
          {
            idOpenflights: 2147480000,
            nombre: 'A; B',
            latitud: 0,
            longitud: -58,
            iata: null,
          },
        ]);
      } finally {
        await rm(directory, { recursive: true });
      }
    });
    it('rejects inherited property names as missing CSV columns', async () => {
      const directory = await mkdtemp(
        join(tmpdir(), 'flywise-inherited-column-'),
      );
      try {
        const file = join(directory, 'aeropuertos.csv');
        await writeFile(file, 'id;title;lat;lng\n42;Aeropuerto;0;0\n');
        await expect(
          service.importCatalog('aeropuertos', file, undefined, {
            ...configuration,
            mapeoEsquema: configuration.mapeoEsquema.map((rule) =>
              rule.campoDestino === 'nombre'
                ? { ...rule, columnaOrigen: 'toString' }
                : rule,
            ),
          }),
        ).rejects.toThrow(/columnas que no existen/);
      } finally {
        await rm(directory, { recursive: true });
      }
    });
    it('fails a wrong mapping before writing or classifying all rows as discarded', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-mapping-'));
      try {
        const file = join(directory, 'aeropuertos.csv');
        await writeFile(file, 'wrong;columns\n1;2\n');
        await expect(
          service.importCatalog('aeropuertos', file, undefined, configuration),
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
      expect(prismaMock.models.EjecucionEtl.create).not.toHaveBeenCalled();
    });

    it('marks the job failed if it cannot be queued', async () => {
      queueMock.add.mockRejectedValueOnce(new Error('Queue unavailable'));
      await expect(service.triggerJob('all')).rejects.toThrow(
        'Queue unavailable',
      );
      expect(prismaMock.models.EjecucionEtl.update).toHaveBeenCalledWith({
        estado: 'failed',
        mensajeError: 'Queue unavailable',
      });
    });
    it('should create database record and enqueue BullMQ job', async () => {
      const res = await service.triggerJob('aeropuertos');

      expect(prismaMock.models.EjecucionEtl.create).toHaveBeenCalledWith({
        fuente: 'aeropuertos',
        estado: 'pending',
      });
      expect(queueMock.add).toHaveBeenCalled();
      expect(res.ejecucionId).toBe('job-record-1');
      expect(res.bullJobId).toBe('bull-job-1');
    });
  });

  describe('getStatus', () => {
    it('should return queue metricas', async () => {
      const res = await service.getStatus();
      expect(queueMock.getActiveCount).toHaveBeenCalled();
      expect(res.counts.activa).toBe(1);
      expect(res.counts.completed).toBe(5);
    });
  });

  describe('getHistory', () => {
    it('derives duration from timestamps and leaves unfinished ejecuciones without a duration', async () => {
      prismaMock.models.EjecucionEtl.all.mockResolvedValue([
        {
          id: 'finished',
          iniciadoEn: '2026-09-01 00:00:00',
          finalizadoEn: '2026-09-01 00:00:02',
        },
        { id: 'pending', iniciadoEn: null, finalizadoEn: null },
      ]);
      const history = await service.getHistory();
      expect(history.map((job) => job.durationMs)).toEqual([2000, null]);
    });
    it('should return recent ETL ejecuciones', async () => {
      const res = await service.getHistory();
      expect(prismaMock.models.EjecucionEtl.all).toHaveBeenCalled();
      expect(res).toHaveLength(1);
    });
  });
});
