import { Test, TestingModule } from '@nestjs/testing';
import { AirlinesController } from './airlines.controller';
import { AirlinesService } from './airlines.service';

describe('AirlinesController', () => {
  let controller: AirlinesController;
  let airlinesService: {
    findAll: jest.Mock;
    findByCode: jest.Mock;
  };

  const mockAirline = {
    id: 'airline-uuid-1',
    name: 'Aerolineas Argentinas',
    iata: 'AR',
  };

  beforeEach(async () => {
    airlinesService = {
      findAll: jest.fn().mockResolvedValue({
        data: [mockAirline],
        pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      }),
      findByCode: jest.fn().mockResolvedValue(mockAirline),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirlinesController],
      providers: [
        {
          provide: AirlinesService,
          useValue: airlinesService,
        },
      ],
    }).compile();

    controller = module.get<AirlinesController>(AirlinesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll and return paginated data', async () => {
    const res = await controller.findAll({ page: 1, limit: 10 });
    expect(airlinesService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
    expect(res.data).toHaveLength(1);
  });

  it('should call findByCode and return specific airline', async () => {
    const res = await controller.findByCode('AR');
    expect(airlinesService.findByCode).toHaveBeenCalledWith('AR');
    expect(res).toEqual(mockAirline);
  });
});
