import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: { $queryRaw: jest.Mock };
  let redisService: { ping: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    redisService = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return 200 OK when both DB and Redis are up', async () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockRes = { status: mockStatus } as unknown as Response;

    await controller.check(mockRes);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        services: { database: 'up', redis: 'up' },
      }),
    );
  });

  it('should return 503 SERVICE_UNAVAILABLE when DB fails', async () => {
    prismaService.$queryRaw.mockRejectedValue(new Error('Connection lost'));

    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockRes = { status: mockStatus } as unknown as Response;

    await controller.check(mockRes);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        services: { database: 'down', redis: 'up' },
      }),
    );
  });
});
