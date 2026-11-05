import { Test, TestingModule } from '@nestjs/testing';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

describe('RoutesController', () => {
  let controller: RoutesController;
  let routesService: {
    explore: jest.Mock;
    findDirect: jest.Mock;
  };

  const mockArc = {
    id: 'route-uuid-1',
    origen: { iata: 'EZE', coordenadas: [-58.5358, -34.8222] },
    destino: { iata: 'MIA', coordenadas: [-80.2906, 25.7959] },
    distanciaKm: 7098.5,
  };

  beforeEach(async () => {
    routesService = {
      explore: jest.fn().mockResolvedValue([mockArc]),
      findDirect: jest.fn().mockResolvedValue({
        origen: { iata: 'EZE' },
        destino: { iata: 'MIA' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutesController],
      providers: [
        {
          provide: RoutesService,
          useValue: routesService,
        },
      ],
    }).compile();

    controller = module.get<RoutesController>(RoutesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call explore and return Deck.gl formatted rutas', async () => {
    const res = await controller.explore({ limit: 100 });
    expect(routesService.explore).toHaveBeenCalledWith({ limit: 100 });
    expect(res).toEqual([mockArc]);
  });

  it('should call findDirect and return route details', async () => {
    const res = await controller.findDirect({
      origen: 'EZE',
      destino: 'MIA',
    });
    expect(routesService.findDirect).toHaveBeenCalledWith({
      origen: 'EZE',
      destino: 'MIA',
    });
    expect(res).toHaveProperty('origen');
  });
});
