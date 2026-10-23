import { Test, TestingModule } from '@nestjs/testing';
import { RoutesService } from './routes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('RoutesService', () => {
  let service: RoutesService;
  let prismaService: {
    route: {
      findMany: jest.Mock;
    };
  };

  const mockRoute = {
    id: 'route-uuid-1',
    airlineCode: 'AR',
    originIata: 'EZE',
    destinationIata: 'MIA',
    stops: 0,
    equipment: '330',
    distanceKm: 7098.5,
    distanceNm: 3832.9,
    popularityScore: 18.2,
    isTop100: true,
    origin: {
      iata: 'EZE',
      name: 'Ministro Pistarini',
      city: 'Buenos Aires',
      countryName: 'Argentina',
      latitude: -34.8222,
      longitude: -58.5358,
    },
    destination: {
      iata: 'MIA',
      name: 'Miami International Airport',
      city: 'Miami',
      countryName: 'United States',
      latitude: 25.7959,
      longitude: -80.2906,
    },
    airline: {
      iata: 'AR',
      name: 'Aerolineas Argentinas',
    },
  };

  beforeEach(async () => {
    prismaService = {
      route: {
        findMany: jest.fn().mockResolvedValue([mockRoute]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<RoutesService>(RoutesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('explore', () => {
    it('should return routes formatted as Deck.gl arcs', async () => {
      const res = await service.explore({ limit: 10 });

      expect(prismaService.route.findMany).toHaveBeenCalled();
      expect(res).toHaveLength(1);
      expect(res[0].origin.coordinates).toEqual([-58.5358, -34.8222]);
      expect(res[0].destination.coordinates).toEqual([-80.2906, 25.7959]);
      expect(res[0].distanceKm).toBe(7098.5);
      expect(res[0].isTop100).toBe(true);
    });

    it('should query by origin when provided', async () => {
      await service.explore({ origin: 'EZE' });

      expect(prismaService.route.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ originIata: 'EZE' }, { destinationIata: 'EZE' }],
          },
        }),
      );
    });
  });

  describe('findDirect', () => {
    it('should return route details and airline operators', async () => {
      const res = await service.findDirect({
        origin: 'EZE',
        destination: 'MIA',
      });

      expect(prismaService.route.findMany).toHaveBeenCalled();
      expect(res.origin.iata).toBe('EZE');
      expect(res.destination.iata).toBe('MIA');
      expect(res.operatorsCount).toBe(1);
      expect(res.operators[0].airlineName).toBe('Aerolineas Argentinas');
    });

    it('should throw NotFoundException when no direct routes exist', async () => {
      prismaService.route.findMany.mockResolvedValue([]);

      await expect(
        service.findDirect({ origin: 'EZE', destination: 'HND' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate great circle distance between EZE and MIA with high precision', () => {
      const dist = service.calculateDistance(
        -34.8222,
        -58.5358,
        25.7959,
        -80.2906,
      );
      // Distance is ~7098 km
      expect(dist).toBeGreaterThan(7000);
      expect(dist).toBeLessThan(7200);
    });
  });
});
