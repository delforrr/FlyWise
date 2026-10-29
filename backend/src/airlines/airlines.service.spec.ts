import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { AirlinesService } from './airlines.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

describe('AirlinesService', () => {
  let service: AirlinesService;
  let prismaService: {
    models: {
      Airline: ReturnType<typeof mockCollection>;
      Airport: ReturnType<typeof mockCollection>;
      Country: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
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
      models: {
        Airline: mockCollection(),
        Airport: mockCollection(),
        Country: mockCollection(),
      },
      db: mockDatabase(),
    };
    prismaService.models.Airline.all.mockResolvedValue([mockAirline]);
    prismaService.models.Airline.aggregate.mockResolvedValue({ totalItems: 1 });

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
      expect(prismaService.models.Airline.all).toHaveBeenCalled();
      expect(prismaService.models.Airline.aggregate).toHaveBeenCalled();
      expect(res.data).toEqual([mockAirline]);
      expect(res.pagination.totalItems).toBe(1);
    });
  });

  describe('findByCode', () => {
    it('should return airline by IATA code', async () => {
      prismaService.models.Airline.all.mockResolvedValue([mockAirline]);
      const res = await service.findByCode('AR');
      expect(prismaService.models.Airline.all).toHaveBeenCalled();
      expect(res).toEqual(mockAirline);
    });

    it('should throw NotFoundException if airline is not found', async () => {
      prismaService.models.Airline.all.mockResolvedValue([]);
      await expect(service.findByCode('XX')).rejects.toThrow(NotFoundException);
    });
  });
});
