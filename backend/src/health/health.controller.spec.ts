import { mockDatabase } from '../../test/helpers/prisma-mock.js';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: { db: ReturnType<typeof mockDatabase> };
  let redisService: { ping: jest.Mock };

  beforeEach(async () => {
    prismaService = { db: mockDatabase() };
    prismaService.db.query.mockResolvedValue([{ ok: 1 }]);
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
        estado: 'ok',
        services: { database: 'up', redis: 'up' },
      }),
    );
  });

  it('should return 503 SERVICE_UNAVAILABLE when DB fails', async () => {
    prismaService.db.query.mockRejectedValue(new Error('Connection lost'));

    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockRes = { status: mockStatus } as unknown as Response;

    await controller.check(mockRes);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: 'degraded',
        services: { database: 'down', redis: 'up' },
      }),
    );
  });
});
