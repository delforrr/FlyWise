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
      Airline: ReturnType<typeof mockCollection>;
      Airport: ReturnType<typeof mockCollection>;
      Country: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
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
    routeCount: 120,
  };

  beforeEach(async () => {
    prismaService = {
      models: {
        Airline: mockCollection(),
        Airport: mockCollection(),
        Country: mockCollection(),
      },
      db: mockDatabase(),
    };
    prismaService.models.Airport.all.mockResolvedValue([mockAirport]);

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

      expect(prismaService.models.Airport.all).toHaveBeenCalled();
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
      prismaService.db.query.mockResolvedValue(mockNearby);

      const results = await service.findNearby({
        lat: -34.6,
        lng: -58.4,
        radiusKm: 50,
      });

      expect(prismaService.db.query).toHaveBeenCalled();
      expect(results).toEqual(mockNearby);
      expect(results[0].distanceKm).toBe(25.4);
    });
  });

  describe('findByCode', () => {
    it('should return airport when found by IATA or ICAO', async () => {
      prismaService.models.Airport.all.mockResolvedValue([mockAirport]);

      const result = await service.findByCode('EZE');
      expect(prismaService.models.Airport.all).toHaveBeenCalled();
      expect(result).toEqual(mockAirport);
    });

    it('should throw NotFoundException when airport is not found', async () => {
      prismaService.models.Airport.all.mockResolvedValue([]);

      await expect(service.findByCode('XYZ')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
