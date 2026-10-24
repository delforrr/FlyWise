import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service.js';
import { ConfigService } from '@nestjs/config';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined and return client instance', () => {
    expect(service).toBeDefined();
    expect(service.getClient()).toBeDefined();
  });

  it('should set, get, and delete keys using redis client', async () => {
    const client = service.getClient();
    jest.spyOn(client, 'set').mockResolvedValue('OK');
    jest.spyOn(client, 'get').mockResolvedValue('test-val');
    jest.spyOn(client, 'del').mockResolvedValue(1);

    await service.set('key1', 'test-val', 3600);
    expect(client.set).toHaveBeenCalledWith('key1', 'test-val', 'EX', 3600);

    const val = await service.get('key1');
    expect(val).toBe('test-val');

    const deleted = await service.del('key1');
    expect(deleted).toBe(1);
  });
});
