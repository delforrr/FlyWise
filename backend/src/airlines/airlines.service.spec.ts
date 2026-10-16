import { Test, TestingModule } from '@nestjs/testing';
import { AirlinesService } from './airlines.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AirlinesService', () => {
  let service: AirlinesService;
  let prismaService: {
    airline: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  const mockAirline = {
    id: 'airline-uuid-1',
    name: 'Aerolineas Argentinas',
    iata: 'AR',
    icao: 'ARG',
    active: true,
  };

  beforeEach(async () => {
    prismaService = {
      airline: {
        findMany: jest.fn().mockResolvedValue([mockAirline]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirlinesService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AirlinesService>(AirlinesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated airlines', async () => {
      const res = await service.findAll({ page: 1, limit: 10 });
      expect(prismaService.airline.findMany).toHaveBeenCalled();
      expect(prismaService.airline.count).toHaveBeenCalled();
      expect(res.data).toEqual([mockAirline]);
      expect(res.pagination.totalItems).toBe(1);
    });
  });

  describe('findByCode', () => {
    it('should return airline by IATA code', async () => {
      prismaService.airline.findFirst.mockResolvedValue(mockAirline);
      const res = await service.findByCode('AR');
      expect(prismaService.airline.findFirst).toHaveBeenCalled();
      expect(res).toEqual(mockAirline);
    });

    it('should throw NotFoundException if airline is not found', async () => {
      prismaService.airline.findFirst.mockResolvedValue(null);
      await expect(service.findByCode('XX')).rejects.toThrow(NotFoundException);
    });
  });
});
