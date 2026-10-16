import { Test, TestingModule } from '@nestjs/testing';
import { AirportsController } from './airports.controller';
import { AirportsService } from './airports.service';

describe('AirportsController', () => {
  let controller: AirportsController;
  let airportsService: {
    search: jest.Mock;
    findNearby: jest.Mock;
    findByCode: jest.Mock;
  };

  const mockAirport = {
    id: 'airport-uuid-1',
    name: 'Ministro Pistarini',
    iata: 'EZE',
  };

  beforeEach(async () => {
    airportsService = {
      search: jest.fn().mockResolvedValue([mockAirport]),
      findNearby: jest
        .fn()
        .mockResolvedValue([{ ...mockAirport, distanceKm: 12 }]),
      findByCode: jest.fn().mockResolvedValue(mockAirport),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirportsController],
      providers: [
        {
          provide: AirportsService,
          useValue: airportsService,
        },
      ],
    }).compile();

    controller = module.get<AirportsController>(AirportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should delegate search to service', async () => {
      const res = await controller.search({ q: 'EZE', limit: 5 });
      expect(airportsService.search).toHaveBeenCalledWith({
        q: 'EZE',
        limit: 5,
      });
      expect(res).toEqual([mockAirport]);
    });
  });

  describe('findNearby', () => {
    it('should delegate findNearby to service', async () => {
      const dto = { lat: -34.82, lng: -58.53, radiusKm: 100 };
      const res = await controller.findNearby(dto);
      expect(airportsService.findNearby).toHaveBeenCalledWith(dto);
      expect(res).toHaveLength(1);
    });
  });

  describe('findByCode', () => {
    it('should delegate findByCode to service', async () => {
      const res = await controller.findByCode('EZE');
      expect(airportsService.findByCode).toHaveBeenCalledWith('EZE');
      expect(res).toEqual(mockAirport);
    });
  });
});
