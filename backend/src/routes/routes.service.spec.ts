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
      id: 'airport-a',
      iata: 'EZE',
      name: 'Ministro Pistarini',
      city: 'Buenos Aires',
      countryName: 'Argentina',
      latitude: -34.8222,
      longitude: -58.5358,
    },
    destination: {
      id: 'airport-b',
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

  it('returns all operators in both directions when includeReturn is requested', async () => {
    const back = { ...mockRoute, id: 'back', origin: mockRoute.destination, destination: mockRoute.origin };
    prismaService.models.Route.all.mockResolvedValue([mockRoute, back]);
    prismaService.db.query.mockResolvedValue([{ id: mockRoute.id, distanceKm: 100 }, { id: 'back', distanceKm: 100 }]);
    const result = await service.explore({ originId: 'airport-a', destinationId: 'airport-b', includeReturn: true });
    expect(result.map(r => r.origin.id)).toEqual(['airport-a', 'airport-b']);
    expect(prismaService.models.Route.limit).not.toHaveBeenCalled();
    await expect(service.explore({ includeReturn: true })).rejects.toThrow('requiere origen y destino');
  });

  it('groups selected pairs in ranking order and retains each direction and operator', async () => {
    const secondOperator = { ...mockRoute, id: 'operator2', airline: { iata: 'ZZ', name: 'Second' } };
    const back = { ...mockRoute, id: 'back', origin: mockRoute.destination, destination: mockRoute.origin };
    prismaService.models.Route.all.mockResolvedValue([back, mockRoute, secondOperator]);
    prismaService.db.query.mockResolvedValueOnce([
      { id: mockRoute.id, originId: 'airport-a', destinationId: 'airport-b' },
      { id: 'operator2', originId: 'airport-a', destinationId: 'airport-b' },
      { id: 'back', originId: 'airport-a', destinationId: 'airport-b' },
    ]).mockResolvedValueOnce([mockRoute, secondOperator, back].map(r => ({ id: r.id, distanceKm: 100 })));
    const result = await service.global({ mode: 'global', limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].outbound.map(r => r.airline.iata)).toEqual(['AR', 'ZZ']);
    expect(result[0].inbound[0].origin.id).toBe('airport-b');
  });

  it('returns an empty global result without fetching offers or distances', async () => {
    prismaService.db.query.mockResolvedValue([]);
    expect(await service.global({ mode: 'global', limit: 50 })).toEqual([]);
    expect(prismaService.models.Route.all).not.toHaveBeenCalled();
    expect(prismaService.db.query).toHaveBeenCalledTimes(1);
  });

  it('rejects identical countries and continents for directional filters', async () => {
    await expect(service.global({ mode: 'countries', limit: 10, originCountryId: 'same', destinationCountryId: 'same' })).rejects.toThrow('dos lugares diferentes');
    await expect(service.global({ mode: 'continents', limit: 10, originContinent: 'SA', destinationContinent: 'SA' })).rejects.toThrow('dos lugares diferentes');
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
