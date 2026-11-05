import { Test, TestingModule } from '@nestjs/testing';
import { CountriesController } from './countries.controller.js';
import { CountriesService } from './countries.service.js';

describe('CountriesController', () => {
  let controller: CountriesController;
  let countriesService: {
    findAll: jest.Mock;
    findByName: jest.Mock;
  };

  const mockCountry = {
    id: 'pais-uuid-1',
    nombre: 'Argentina',
    codigoIso: 'AR',
  };

  beforeEach(async () => {
    countriesService = {
      findAll: jest.fn().mockResolvedValue([mockCountry]),
      findByName: jest.fn().mockResolvedValue(mockCountry),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CountriesController],
      providers: [
        {
          provide: CountriesService,
          useValue: countriesService,
        },
      ],
    }).compile();

    controller = module.get<CountriesController>(CountriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll and return list of paises', async () => {
    const res = await controller.findAll();
    expect(countriesService.findAll).toHaveBeenCalled();
    expect(res).toEqual([mockCountry]);
  });

  it('should call findByName and return specific pais', async () => {
    const res = await controller.findByName('Argentina');
    expect(countriesService.findByName).toHaveBeenCalledWith('Argentina');
    expect(res).toEqual(mockCountry);
  });
});
