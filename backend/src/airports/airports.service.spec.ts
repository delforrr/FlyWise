import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { AirportsService } from './airports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

describe('AirportsService', () => {
  let service: AirportsService;
  const redis = {
    get: jest.fn<Promise<string | null>, [string]>(),
    set: jest.fn<Promise<void>, [string, string, number?]>(),
  };
  let prismaService: {
    models: {
      Aerolinea: ReturnType<typeof mockCollection>;
      Aeropuerto: ReturnType<typeof mockCollection>;
      Pais: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
  };

  const mockAirport = {
    id: 'airport-uuid-1',
    idOpenflights: 1,
    nombre: 'Ministro Pistarini International Aeropuerto',
    ciudad: 'Buenos Aires',
    nombrePais: 'Argentina',
    iata: 'EZE',
    icao: 'SAEZ',
    latitud: -34.8222,
    longitud: -58.5358,
    cantidadRutas: 120,
  };

  beforeEach(async () => {
    redis.get.mockReset().mockResolvedValue(null);
    redis.set.mockReset().mockResolvedValue(undefined);
    prismaService = {
      models: {
        Aerolinea: mockCollection(),
        Aeropuerto: mockCollection(),
        Pais: mockCollection(),
      },
      db: mockDatabase(),
    };
    prismaService.models.Aeropuerto.all.mockResolvedValue([mockAirport]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirportsService,
        { provide: RedisService, useValue: redis },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AirportsService>(AirportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should query aeropuertos by search term and return results', async () => {
      const results = await service.search({ q: 'EZE', limit: 10 });

      expect(prismaService.models.Aeropuerto.all).toHaveBeenCalled();
      expect(results).toEqual([mockAirport]);
    });
  });

  it('prioritizes exact codes, removes duplicates and caps results', async () => {
    const other = { ...mockAirport, id: 'airport-uuid-2', iata: 'ABC' };
    prismaService.models.Aeropuerto.all
      .mockResolvedValueOnce([mockAirport])
      .mockResolvedValueOnce([other, mockAirport]);
    await expect(service.search({ q: ' eZe ', limit: 2 })).resolves.toEqual([
      mockAirport,
      other,
    ]);
  });

  it('falls back to name or city when short text has no exact code match', async () => {
    prismaService.models.Aeropuerto.all.mockResolvedValueOnce([]);
    await expect(service.search({ q: 'BUE', limit: 20 })).resolves.toEqual([
      mockAirport,
    ]);
    expect(prismaService.models.Aeropuerto.all).toHaveBeenCalledTimes(2);
  });

  describe('search cache', () => {
    it('caches empty results for 60 seconds and separates result limits', async () => {
      prismaService.models.Aeropuerto.all.mockResolvedValue([]);
      await expect(
        service.search({ q: '  Buenos Aires ', limit: 20 }),
      ).resolves.toEqual([]);
      const key = redis.get.mock.calls[0][0];
      expect(redis.set).toHaveBeenCalledWith(key, '[]', 60);
      redis.get.mockResolvedValueOnce('[]');
      await expect(
        service.search({ q: 'buenos aires', limit: 20 }),
      ).resolves.toEqual([]);
      expect(redis.get).toHaveBeenLastCalledWith(key);
      expect(prismaService.models.Aeropuerto.all).toHaveBeenCalledTimes(1);
      await service.search({ q: 'Buenos Aires', limit: 10 });
      expect(redis.get.mock.calls[2][0]).not.toBe(key);
      await service.search({ q: 'Buenos Aires', limit: 20 });
      expect(redis.get).toHaveBeenLastCalledWith(key);
      expect(prismaService.models.Aeropuerto.all).toHaveBeenCalledTimes(3);
    });

    it('separates a code from a term with the same lowercase spelling', async () => {
      await service.search({ q: 'KLM', limit: 20 });
      await service.search({ q: 'KLM', limit: 20 });
      expect(redis.get.mock.calls[0][0]).not.toBe(redis.get.mock.calls[1][0]);
    });

    it('queries the database if Redis is unresponsive', async () => {
      redis.get.mockImplementationOnce(() => new Promise(() => {}));
      await expect(
        service.search({ q: 'Buenos Aires', limit: 20 }),
      ).resolves.toEqual([mockAirport]);
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('findNearby', () => {
    it('should execute PostGIS raw query and return nearby aeropuertos', async () => {
      const mockNearby = [
        {
          ...mockAirport,
          distanciaKm: 25.4,
        },
      ];
      prismaService.db.query.mockResolvedValue(mockNearby);

      const results = await service.findNearby({
        lat: -34.6,
        lng: -58.4,
        radiusKm: 50,
      });

      expect(prismaService.db.query).toHaveBeenCalled();
      expect(results).toEqual(mockNearby);
      expect(results[0].distanciaKm).toBe(25.4);
    });
  });

  describe('findByCode', () => {
    it('should return airport when found by IATA or ICAO', async () => {
      prismaService.models.Aeropuerto.all.mockResolvedValue([mockAirport]);

      const result = await service.findByCode('EZE');
      expect(prismaService.models.Aeropuerto.all).toHaveBeenCalled();
      expect(result).toEqual(mockAirport);
    });

    it('should throw NotFoundException when airport is not found', async () => {
      prismaService.models.Aeropuerto.all.mockResolvedValue([]);

      await expect(service.findByCode('XYZ')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
