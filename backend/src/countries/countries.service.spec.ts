import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { CountriesService } from './countries.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

describe('CountriesService', () => {
  let service: CountriesService;
  let prismaService: {
    models: {
      Aerolinea: ReturnType<typeof mockCollection>;
      Aeropuerto: ReturnType<typeof mockCollection>;
      Pais: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
  };

  const mockCountry = {
    id: 'pais-uuid-1',
    nombre: 'Argentina',
    codigoIso: 'AR',
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
    prismaService.models.Pais.all.mockResolvedValue([mockCountry]);
    prismaService.models.Aeropuerto.all.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountriesService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<CountriesService>(CountriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all paises', async () => {
      const res = await service.findAll();
      expect(prismaService.models.Pais.all).toHaveBeenCalled();
      expect(res).toEqual([{ ...mockCountry, continent: 'SA' }]);
    });
  });

  describe('findByName', () => {
    it('should return pais by nombre', async () => {
      prismaService.models.Pais.first.mockResolvedValue(mockCountry);
      const res = await service.findByName('Argentina');
      expect(prismaService.models.Pais.first).toHaveBeenCalled();
      expect(res).toEqual({ ...mockCountry, aeropuertos: [] });
    });

    it('should throw NotFoundException if pais not found', async () => {
      prismaService.models.Pais.first.mockResolvedValue(null);
      await expect(service.findByName('Atlantis')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
