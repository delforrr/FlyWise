import { catalogFile } from '../../test/helpers/catalog-file.js';
import { CatalogImportService } from './catalog-import.service.js';
import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PipelineConfiguration } from './interfaces/pipeline-configuration.js';

describe('CatalogImportService', () => {
  let catalog: CatalogImportService;
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
        CatalogImportService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    catalog = module.get(CatalogImportService);
  });

  it('should be defined', () => {
    expect(catalog).toBeDefined();
  });

  it.each(['aeropuertos', 'aerolineas', 'paises'] as const)(
    '%s rejects unreadable files instead of leaving an unhandled stream error',
    async (method) => {
      await expect(
        catalog.importCatalog(
          method,
          catalogFile('/missing/flywise-audit-file.dat'),
        ),
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
      const pais = prismaMock.db.orm.public.Pais;
      pais.createAll
        .mockImplementationOnce((rows: { id: string }[]) => rows.slice(1))
        .mockImplementationOnce((rows: { id: string }[]) => rows);
      await expect(
        catalog.importCatalog('paises', catalogFile(file)),
      ).resolves.toEqual({
        total: 2001,
        processed: 2001,
        inserted: 2000,
        discarded: 0,
      });
      expect(
        pais.createAll.mock.calls.map(([rows]) => (rows as unknown[]).length),
      ).toEqual([2000, 1]);
      expect(pais.updateAndCount).toHaveBeenCalledWith({ codigoIso: 'XX' });
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it.each([
    [
      'aeropuertos',
      '1,Ezeiza,City,Argentina,EZE,SAEZ,-34,-58,0,0,N,UTC,airport,OpenFlights',
    ],
    ['aerolineas', '1,Aerolinea,Alias,AR,ARG,Callsign,Argentina,Y'],
  ] as const)(
    '%s does not count duplicate rows as inserts',
    async (method, row) => {
      const directory = await mkdtemp(join(tmpdir(), 'flywise-duplicates-'));
      try {
        const file = join(directory, 'catalog.dat');
        await writeFile(file, row);
        await expect(
          catalog.importCatalog(method, catalogFile(file)),
        ).resolves.toEqual({
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
      await expect(
        catalog.importCatalog('aeropuertos', catalogFile(file)),
      ).resolves.toEqual({
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
            catalog.importCatalog('aeropuertos', catalogFile(file), undefined, {
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
            catalog.importCatalog('aeropuertos', catalogFile(file), undefined, {
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
          catalog.importCatalog(
            'aeropuertos',
            catalogFile(file),
            undefined,
            configuration,
          ),
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
          catalog.importCatalog('aeropuertos', catalogFile(file), undefined, {
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
          catalog.importCatalog(
            'aeropuertos',
            catalogFile(file),
            undefined,
            configuration,
          ),
        ).rejects.toThrow(/columnas/);
        expect(prismaMock.db.query).not.toHaveBeenCalled();
      } finally {
        await rm(directory, { recursive: true });
      }
    });
  });
});
