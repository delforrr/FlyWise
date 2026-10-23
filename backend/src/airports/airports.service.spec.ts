import { Test, TestingModule } from '@nestjs/testing';
import { AirportsService } from './airports.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AirportsService', () => {
  let service: AirportsService;
  let prismaService: {
    airport: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  const mockAirport = {
    id: 'airport-uuid-1',
    openflightsId: 1,
    name: 'Ministro Pistarini International Airport',
    city: 'Buenos Aires',
    countryName: 'Argentina',
    iata: 'EZE',
    icao: 'SAEZ',
    latitude: -34.8222,
    longitude: -58.5358,
    altitudeFt: 67,
    routeCount: 120,
  };

  beforeEach(async () => {
    prismaService = {
      airport: {
        findMany: jest.fn().mockResolvedValue([mockAirport]),
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

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
    it('should query airports by search term and return results', async () => {
      const results = await service.search({ q: 'EZE', limit: 10 });

      expect(prismaService.airport.findMany).toHaveBeenCalled();
      expect(results).toEqual([mockAirport]);
    });
  });

  describe('findNearby', () => {
    it('should execute PostGIS raw query and return nearby airports', async () => {
      const mockNearby = [
        {
          ...mockAirport,
          distanceKm: 25.4,
        },
      ];
      prismaService.$queryRaw.mockResolvedValue(mockNearby);

      const results = await service.findNearby({
        lat: -34.6,
        lng: -58.4,
        radiusKm: 50,
      });

      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(results).toEqual(mockNearby);
      expect(results[0].distanceKm).toBe(25.4);
    });
  });

  describe('findByCode', () => {
    it('should return airport when found by IATA or ICAO', async () => {
      prismaService.airport.findFirst.mockResolvedValue(mockAirport);

      const result = await service.findByCode('EZE');
      expect(prismaService.airport.findFirst).toHaveBeenCalled();
      expect(result).toEqual(mockAirport);
    });

    it('should throw NotFoundException when airport is not found', async () => {
      prismaService.airport.findFirst.mockResolvedValue(null);

      await expect(service.findByCode('XYZ')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
