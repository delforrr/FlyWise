import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { AirportsService } from './airports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

describe('AirportsService', () => {
  let service: AirportsService;
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
