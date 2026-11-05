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
      Aerolinea: ReturnType<typeof mockCollection>;
      Aeropuerto: ReturnType<typeof mockCollection>;
      Pais: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
  };

  const mockAirline = {
    id: 'aerolinea-uuid-1',
    nombre: 'Aerolineas Argentinas',
    iata: 'AR',
    icao: 'ARG',
    activa: true,
  };

  beforeEach(async () => {
    prismaService = {
      models: {
        Aerolinea: mockCollection(),
        Aeropuerto: mockCollection(),
        Pais: mockCollection(),
      },
      db: mockDatabase(),
    };
    prismaService.models.Aerolinea.all.mockResolvedValue([mockAirline]);
    prismaService.models.Aerolinea.aggregate.mockResolvedValue({
      totalItems: 1,
    });

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
    it('should return paginated aerolineas', async () => {
      const res = await service.findAll({ page: 1, limit: 10 });
      expect(prismaService.models.Aerolinea.all).toHaveBeenCalled();
      expect(prismaService.models.Aerolinea.aggregate).toHaveBeenCalled();
      expect(res.data).toEqual([mockAirline]);
      expect(res.pagination.totalItems).toBe(1);
    });
  });

  describe('findByCode', () => {
    it('should return aerolinea by IATA code', async () => {
      prismaService.models.Aerolinea.all.mockResolvedValue([mockAirline]);
      const res = await service.findByCode('AR');
      expect(prismaService.models.Aerolinea.all).toHaveBeenCalled();
      expect(res).toEqual(mockAirline);
    });

    it('should throw NotFoundException if aerolinea is not found', async () => {
      prismaService.models.Aerolinea.all.mockResolvedValue([]);
      await expect(service.findByCode('XX')).rejects.toThrow(NotFoundException);
    });
  });
});
