import { Test, TestingModule } from '@nestjs/testing';
import { CountriesService } from './countries.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('CountriesService', () => {
  let service: CountriesService;
  let prismaService: {
    country: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    airport: {
      findMany: jest.Mock;
    };
  };

  const mockCountry = {
    id: 'country-uuid-1',
    name: 'Argentina',
    isoCode: 'AR',
    dafifCode: 'AR',
  };

  beforeEach(async () => {
    prismaService = {
      country: {
        findMany: jest.fn().mockResolvedValue([mockCountry]),
        findFirst: jest.fn(),
      },
      airport: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

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
    it('should return all countries', async () => {
      const res = await service.findAll();
      expect(prismaService.country.findMany).toHaveBeenCalled();
      expect(res).toEqual([mockCountry]);
    });
  });

  describe('findByName', () => {
    it('should return country by name', async () => {
      prismaService.country.findFirst.mockResolvedValue(mockCountry);
      const res = await service.findByName('Argentina');
      expect(prismaService.country.findFirst).toHaveBeenCalled();
      expect(res).toEqual({ ...mockCountry, airports: [] });
    });

    it('should throw NotFoundException if country not found', async () => {
      prismaService.country.findFirst.mockResolvedValue(null);
      await expect(service.findByName('Atlantis')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
