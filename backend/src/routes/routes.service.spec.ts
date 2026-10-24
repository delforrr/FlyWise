import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { RoutesService } from './routes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

describe('RoutesService', () => {
  let service: RoutesService;
  let prismaService: {
    models: { Route: ReturnType<typeof mockCollection> };
    db: ReturnType<typeof mockDatabase>;
  };

  const mockRoute = {
    id: 'route-uuid-1',
    airlineCode: 'AR',
    stops: 0,
    distanceKm: 7098.5,
    popularityScore: 18.2,
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
    prismaService = { models: { Route: mockCollection() }, db: mockDatabase() };
    prismaService.models.Route.all.mockResolvedValue([mockRoute]);
    prismaService.db.query.mockResolvedValue([{ id: mockRoute.id, distanceKm: 7098.5 }]);

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

      expect(prismaService.models.Route.all).toHaveBeenCalled();
      expect(res).toHaveLength(1);
      expect(res[0].origin.coordinates).toEqual([-58.5358, -34.8222]);
      expect(res[0].destination.coordinates).toEqual([-80.2906, 25.7959]);
      expect(res[0].distanceKm).toBe(7098.5);
      expect(res[0].distanceNm).toBeCloseTo(7098.5 / 1.852, 0);
    });
  });

  it('limits routes ordered by connectivity by default', async () => {
    await service.explore({});
    expect(prismaService.models.Route.limit).toHaveBeenCalledWith(100);
  });

  it('uses one PostGIS query for distances without persisted cache and derives nautical miles', async () => {
    prismaService.models.Route.all.mockResolvedValue([
      { ...mockRoute, distanceKm: null },
      { ...mockRoute, id: 'second', distanceKm: null },
    ]);
    prismaService.db.query.mockResolvedValue([
      { id: mockRoute.id, distanceKm: 7098.5 },
      { id: 'second', distanceKm: 1000 },
    ]);
    const routes = await service.explore({});
    expect(prismaService.db.query).toHaveBeenCalledTimes(1);
    expect(routes.map((route) => route.distanceKm)).toEqual([7098.5, 1000]);
    expect(routes[1].distanceNm).toBe(540);
  });

  describe('findDirect', () => {
    it('should return route details and airline operators', async () => {
      const res = await service.findDirect({
        origin: 'EZE',
        destination: 'MIA',
      });

      expect(prismaService.models.Route.all).toHaveBeenCalled();
      expect(res.origin.iata).toBe('EZE');
      expect(res.destination.iata).toBe('MIA');
      expect(res.operatorsCount).toBe(1);
      expect(res.operators[0].airlineName).toBe('Aerolineas Argentinas');
    });

    it('should throw NotFoundException when no direct routes exist', async () => {
      prismaService.models.Route.all.mockResolvedValue([]);

      await expect(
        service.findDirect({ origin: 'EZE', destination: 'HND' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
