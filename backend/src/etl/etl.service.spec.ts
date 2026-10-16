import { Test, TestingModule } from '@nestjs/testing';
import { EtlService } from './etl.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('EtlService', () => {
  let service: EtlService;
  let queueMock: {
    add: jest.Mock;
    getWaitingCount: jest.Mock;
    getActiveCount: jest.Mock;
    getCompletedCount: jest.Mock;
    getFailedCount: jest.Mock;
  };
  let prismaMock: {
    etlJob: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(1),
      getCompletedCount: jest.fn().mockResolvedValue(5),
      getFailedCount: jest.fn().mockResolvedValue(0),
    };

    prismaMock = {
      etlJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-record-1' }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'job-record-1', status: 'completed' }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlService,
        {
          provide: getQueueToken('etl-queue'),
          useValue: queueMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<EtlService>(EtlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerJob', () => {
    it('should create database record and enqueue BullMQ job', async () => {
      const res = await service.triggerJob('airports');

      expect(prismaMock.etlJob.create).toHaveBeenCalledWith({
        data: {
          source: 'airports',
          status: 'pending',
        },
      });
      expect(queueMock.add).toHaveBeenCalled();
      expect(res.jobId).toBe('job-record-1');
      expect(res.bullJobId).toBe('bull-job-1');
    });
  });

  describe('getStatus', () => {
    it('should return queue metrics', async () => {
      const res = await service.getStatus();
      expect(queueMock.getActiveCount).toHaveBeenCalled();
      expect(res.counts.active).toBe(1);
      expect(res.counts.completed).toBe(5);
    });
  });

  describe('getHistory', () => {
    it('should return recent ETL jobs', async () => {
      const res = await service.getHistory();
      expect(prismaMock.etlJob.findMany).toHaveBeenCalled();
      expect(res).toHaveLength(1);
    });
  });
});
