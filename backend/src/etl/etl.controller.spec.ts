import { Test, TestingModule } from '@nestjs/testing';
import { EtlController } from './etl.controller.js';
import { EtlService } from './etl.service.js';

describe('EtlController', () => {
  let controller: EtlController;
  let etlService: {
    triggerJob: jest.Mock;
    getStatus: jest.Mock;
    getHistory: jest.Mock;
  };

  beforeEach(async () => {
    etlService = {
      triggerJob: jest.fn().mockResolvedValue({ message: 'Job encolado' }),
      getStatus: jest
        .fn()
        .mockResolvedValue({ queue: 'etl-queue', counts: { active: 0 } }),
      getHistory: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EtlController],
      providers: [
        {
          provide: EtlService,
          useValue: etlService,
        },
      ],
    }).compile();

    controller = module.get<EtlController>(EtlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call triggerJob on service', async () => {
    const res = await controller.trigger({ dataset: 'all' });
    expect(etlService.triggerJob).toHaveBeenCalledWith('all');
    expect(res).toEqual({ message: 'Job encolado' });
  });

  it('should call getStatus on service', async () => {
    const res = await controller.getStatus();
    expect(etlService.getStatus).toHaveBeenCalled();
    expect(res).toHaveProperty('queue');
  });

  it('should call getHistory on service', async () => {
    const res = await controller.getHistory();
    expect(etlService.getHistory).toHaveBeenCalled();
    expect(res).toEqual([]);
  });
});
