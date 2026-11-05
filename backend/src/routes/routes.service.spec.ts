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
    models: {
      OfertaRuta: ReturnType<typeof mockCollection>;
      Aeropuerto: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
  };

  const flatRoute = {
    id: 'route-uuid-1',
    codigoAerolinea: 'AR',
    escalas: 0,
    distanciaKm: 7098.5,
    popularityScore: 18.2,
    origen: {
      id: 'airport-a',
      iata: 'EZE',
      nombre: 'Ministro Pistarini',
      ciudad: 'Buenos Aires',
      nombrePais: 'Argentina',
      latitud: -34.8222,
      longitud: -58.5358,
    },
    destino: {
      id: 'airport-b',
      iata: 'MIA',
      nombre: 'Miami International Aeropuerto',
      ciudad: 'Miami',
      nombrePais: 'United States',
      latitud: 25.7959,
      longitud: -80.2906,
    },
    aerolinea: {
      iata: 'AR',
      nombre: 'Aerolineas Argentinas',
    },
  };

  function oferta<
    T extends {
      origen: typeof flatRoute.origen;
      destino: typeof flatRoute.destino;
    },
  >(row: T) {
    return {
      ...row,
      rutaId: 'canonical-id',
      ruta: {
        origen: row.origen,
        destino: row.destino,
        origenId: row.origen.id,
        destinoId: row.destino.id,
      },
    };
  }
  const mockRoute = oferta(flatRoute);

  beforeEach(async () => {
    prismaService = {
      models: { OfertaRuta: mockCollection(), Aeropuerto: mockCollection() },
      db: mockDatabase(),
    };
    prismaService.models.Aeropuerto.all
      .mockResolvedValueOnce([{ id: 'airport-a' }])
      .mockResolvedValueOnce([{ id: 'airport-b' }]);
    prismaService.models.OfertaRuta.all.mockResolvedValue([mockRoute]);
    prismaService.db.query.mockResolvedValue([
      { id: mockRoute.id, distanciaKm: 7098.5 },
    ]);

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
    it('should return rutas formatted as Deck.gl arcs', async () => {
      const res = await service.explore({ limit: 10 });

      expect(prismaService.models.OfertaRuta.all).toHaveBeenCalled();
      expect(res).toHaveLength(1);
      expect(res[0].origen.coordenadas).toEqual([-58.5358, -34.8222]);
      expect(res[0].destino.coordenadas).toEqual([-80.2906, 25.7959]);
      expect(res[0].distanciaKm).toBe(7098.5);
      expect(res[0].distanciaNm).toBeCloseTo(7098.5 / 1.852, 0);
    });
  });

  it('limits rutas ordered by connectivity by default', async () => {
    await service.explore({});
    expect(prismaService.models.OfertaRuta.limit).toHaveBeenCalledWith(100);
  });

  it('returns all operadores in both directions when incluirRegreso is requested', async () => {
    const back = {
      ...mockRoute,
      id: 'back',
      origen: mockRoute.destino,
      destino: mockRoute.origen,
    };
    prismaService.models.OfertaRuta.all.mockResolvedValue([
      mockRoute,
      oferta(back),
    ]);
    prismaService.db.query.mockResolvedValue([
      { id: mockRoute.id, distanciaKm: 100 },
      { id: 'back', distanciaKm: 100 },
    ]);
    const result = await service.explore({
      origenId: 'airport-a',
      destinoId: 'airport-b',
      incluirRegreso: true,
    });
    expect(result.map((r) => r.origen.id)).toEqual(['airport-a', 'airport-b']);
    expect(prismaService.models.OfertaRuta.limit).not.toHaveBeenCalled();
    await expect(service.explore({ incluirRegreso: true })).rejects.toThrow(
      'requiere origen y destino',
    );
  });

  it('groups selected pairs in ranking order and retains each direction and operator', async () => {
    const secondOperator = {
      ...mockRoute,
      id: 'operator2',
      aerolinea: { iata: 'ZZ', nombre: 'Second' },
    };
    const back = {
      ...mockRoute,
      id: 'back',
      origen: mockRoute.destino,
      destino: mockRoute.origen,
    };
    prismaService.models.OfertaRuta.all.mockResolvedValue([
      oferta(back),
      mockRoute,
      secondOperator,
    ]);
    prismaService.db.query
      .mockResolvedValueOnce([
        { id: mockRoute.id, origenId: 'airport-a', destinoId: 'airport-b' },
        { id: 'operator2', origenId: 'airport-a', destinoId: 'airport-b' },
        { id: 'back', origenId: 'airport-a', destinoId: 'airport-b' },
      ])
      .mockResolvedValueOnce(
        [mockRoute, secondOperator, back].map((r) => ({
          id: r.id,
          distanciaKm: 100,
        })),
      );
    const result = await service.global({ mode: 'global', limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].ida.map((r) => r.aerolinea.iata)).toEqual(['AR', 'ZZ']);
    expect(result[0].vuelta[0].origen.id).toBe('airport-b');
  });

  it('returns an empty global result without fetching offers or distances', async () => {
    prismaService.db.query.mockResolvedValue([]);
    expect(await service.global({ mode: 'global', limit: 50 })).toEqual([]);
    expect(prismaService.models.OfertaRuta.all).not.toHaveBeenCalled();
    expect(prismaService.db.query).toHaveBeenCalledTimes(1);
  });

  it('rejects identical paises and continents for directional filters', async () => {
    await expect(
      service.global({
        mode: 'paises',
        limit: 10,
        paisOrigenId: 'same',
        paisDestinoId: 'same',
      }),
    ).rejects.toThrow('dos lugares diferentes');
    await expect(
      service.global({
        mode: 'continents',
        limit: 10,
        continenteOrigen: 'SA',
        continenteDestino: 'SA',
      }),
    ).rejects.toThrow('dos lugares diferentes');
  });

  it('uses one PostGIS query for distances without persisted cache and derives nautical miles', async () => {
    prismaService.models.OfertaRuta.all.mockResolvedValue([
      { ...mockRoute, distanciaKm: null },
      { ...mockRoute, id: 'second', distanciaKm: null },
    ]);
    prismaService.db.query.mockResolvedValue([
      { id: mockRoute.id, distanciaKm: 7098.5 },
      { id: 'second', distanciaKm: 1000 },
    ]);
    const rutas = await service.explore({});
    expect(prismaService.db.query).toHaveBeenCalledTimes(1);
    expect(rutas.map((route) => route.distanciaKm)).toEqual([7098.5, 1000]);
    expect(rutas[1].distanciaNm).toBe(540);
  });

  describe('findDirect', () => {
    it('should return route details and aerolinea operadores', async () => {
      const res = await service.findDirect({
        origen: 'EZE',
        destino: 'MIA',
      });

      expect(prismaService.models.OfertaRuta.all).toHaveBeenCalled();
      expect(res.origen.iata).toBe('EZE');
      expect(res.destino.iata).toBe('MIA');
      expect(res.cantidadOperadores).toBe(1);
      expect(res.operadores[0].nombreAerolinea).toBe('Aerolineas Argentinas');
    });

    it('should throw NotFoundException when no direct rutas exist', async () => {
      prismaService.models.OfertaRuta.all.mockResolvedValue([]);

      await expect(
        service.findDirect({ origen: 'EZE', destino: 'HND' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
