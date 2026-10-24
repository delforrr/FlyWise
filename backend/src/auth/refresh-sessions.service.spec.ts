import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { RedisService } from '../redis/redis.service.js';
import { RefreshSessionsService } from './refresh-sessions.service.js';

describe('RefreshSessionsService (Redis)', () => {
  const client = new Redis({
    host: '127.0.0.1',
    port: 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const jwt = new JwtService({ secret: 'test-only-refresh-secret' });
  const service = new RefreshSessionsService(
    { getClient: () => client } as RedisService,
    jwt,
  );
  const ids: string[] = [];

  beforeAll(async () => {
    await client.connect();
  });
  afterEach(async () => {
    if (ids.length)
      await client.del(...ids.splice(0).map((id) => `refresh:${id}`));
  });
  afterAll(async () => {
    service.onModuleDestroy();
    await client.quit();
  });

  it.each([false, true])(
    'limita la sesión y rota sin extender su vencimiento (remember=%s)',
    async (remember) => {
      const first = await service.create('user-1', remember);
      ids.push(first.sessionId);
      const payload = jwt.verify<{ exp: number; iat: number }>(
        first.refreshToken,
        { audience: 'refresh' },
      );
      expect(payload.exp - payload.iat).toBe(remember ? 7 * 86400 : 86400);
      expect(await client.get(`refresh:${first.sessionId}`)).not.toContain(
        first.refreshToken,
      );
      const next = await service.rotate(first.refreshToken);
      expect(next.refreshToken).not.toBe(first.refreshToken);
      expect(jwt.verify<{ exp: number }>(next.refreshToken).exp).toBe(
        payload.exp,
      );
      expect(next.userId).toBe('user-1');
      expect(next.remember).toBe(remember);
      expect(await service.isActive(first.sessionId)).toBe(true);
    },
  );

  it('rechaza replay y revoca toda la sesión, incluidos sus JWT', async () => {
    const first = await service.create('user-1', true);
    ids.push(first.sessionId);
    const next = await service.rotate(first.refreshToken);
    await expect(service.rotate(first.refreshToken)).rejects.toThrow();
    expect(await service.isActive(first.sessionId)).toBe(false);
    await expect(service.rotate(next.refreshToken)).rejects.toThrow();
  });

  it('revoca en logout y rechaza cookies ausentes, falsificadas o vencidas', async () => {
    const first = await service.create('user-1', false);
    ids.push(first.sessionId);
    await expect(service.rotate()).rejects.toThrow();
    await expect(service.rotate(`${first.refreshToken}bad`)).rejects.toThrow();
    expect(await service.isActive(first.sessionId)).toBe(true);
    await service.revoke(first.refreshToken);
    await expect(service.rotate(first.refreshToken)).rejects.toThrow();
    const expired = jwt.sign(
      { sub: 'user-1', sid: first.sessionId, remember: true },
      { audience: 'refresh', expiresIn: -1 },
    );
    await expect(service.rotate(expired)).rejects.toThrow();
    await expect(
      service.rotate(jwt.sign({ sub: 'user-1' }, { audience: 'access' })),
    ).rejects.toThrow();
  });

  it('solo una renovación concurrente consume el token anterior', async () => {
    const first = await service.create('user-1', true);
    ids.push(first.sessionId);
    const results = await Promise.allSettled([
      service.rotate(first.refreshToken),
      service.rotate(first.refreshToken),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await service.isActive(first.sessionId)).toBe(false);
  });
});
