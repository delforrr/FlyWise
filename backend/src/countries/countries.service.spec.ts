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
      Airline: ReturnType<typeof mockCollection>;
      Airport: ReturnType<typeof mockCollection>;
      Country: ReturnType<typeof mockCollection>;
    };
    db: ReturnType<typeof mockDatabase>;
  };

  const mockCountry = {
    id: 'country-uuid-1',
    name: 'Argentina',
    isoCode: 'AR',
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
    prismaService.models.Country.all.mockResolvedValue([mockCountry]);
    prismaService.models.Airport.all.mockResolvedValue([]);

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
      expect(prismaService.models.Country.all).toHaveBeenCalled();
      expect(res).toEqual([mockCountry]);
    });
  });

  describe('findByName', () => {
    it('should return country by name', async () => {
      prismaService.models.Country.first.mockResolvedValue(mockCountry);
      const res = await service.findByName('Argentina');
      expect(prismaService.models.Country.first).toHaveBeenCalled();
      expect(res).toEqual({ ...mockCountry, airports: [] });
    });

    it('should throw NotFoundException if country not found', async () => {
      prismaService.models.Country.first.mockResolvedValue(null);
      await expect(service.findByName('Atlantis')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
