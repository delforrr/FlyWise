import type { Redis } from 'ioredis';
import {
  Injectable,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service.js';

interface RefreshPayload {
  sub: string;
  sid: string;
  remember: boolean;
  exp: number;
}

// La comparación y el reemplazo deben ser atómicos entre todos los workers.
const ROTATE = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
if current ~= ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

@Injectable()
export class RefreshSessionsService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    redis: RedisService,
    private readonly jwt: JwtService,
  ) {
    // Las sesiones deben fallar rápido; BullMQ conserva su conexión y sus reintentos.
    this.client = redis
      .getClient()
      .duplicate({ maxRetriesPerRequest: 1, commandTimeout: 3000 });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  async create(userId: string, remember: boolean) {
    const sessionId = randomUUID();
    const ttl = remember ? 7 * 86400 : 86400;
    const refreshToken = this.sign(userId, sessionId, remember, ttl);
    await this.client.set(
      `refresh:${sessionId}`,
      this.hash(refreshToken),
      'EX',
      ttl,
    );
    return {
      refreshToken,
      sessionId,
      remember,
      expiresAt: this.verify(refreshToken).exp * 1000,
    };
  }

  async rotate(token?: string) {
    const payload = this.verify(token);
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) throw new UnauthorizedException('La sesión venció.');
    const refreshToken = this.sign(
      payload.sub,
      payload.sid,
      payload.remember,
      ttl,
    );
    const rotated = await this.client.eval(
      ROTATE,
      1,
      `refresh:${payload.sid}`,
      this.hash(token!),
      this.hash(refreshToken),
      ttl,
    );
    if (rotated !== 1)
      throw new UnauthorizedException('La sesión venció o fue revocada.');
    return {
      refreshToken,
      sessionId: payload.sid,
      userId: payload.sub,
      remember: payload.remember,
      expiresAt: payload.exp * 1000,
    };
  }

  async inspect(token?: string, revokeOnMismatch = false) {
    const payload = this.verify(token);
    const current = await this.client.get(`refresh:${payload.sid}`);
    if (current !== this.hash(token!)) {
      if (current && revokeOnMismatch) await this.revokeId(payload.sid);
      throw new UnauthorizedException('La sesión venció o fue revocada.');
    }
    return payload;
  }

  async revoke(token?: string) {
    if (!token) return;
    let payload: RefreshPayload;
    try {
      payload = this.verify(token, true);
    } catch {
      return;
    }
    await this.revokeId(payload.sid);
  }

  async revokeId(sessionId: string) {
    await this.client.del(`refresh:${sessionId}`);
  }

  async isActive(sessionId: string) {
    return Boolean(await this.client.exists(`refresh:${sessionId}`));
  }

  private sign(
    userId: string,
    sessionId: string,
    remember: boolean,
    ttl: number,
  ) {
    return this.jwt.sign(
      { sub: userId, sid: sessionId, remember },
      {
        audience: 'refresh',
        expiresIn: ttl,
        jwtid: randomUUID(),
      },
    );
  }

  private verify(token?: string, ignoreExpiration = false): RefreshPayload {
    try {
      if (!token || token.length > 2048) throw new Error();
      const payload = this.jwt.verify<RefreshPayload>(token, {
        audience: 'refresh',
        algorithms: ['HS256'],
        ignoreExpiration,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.remember !== 'boolean' ||
        typeof payload.exp !== 'number'
      )
        throw new Error();
      return payload;
    } catch {
      throw new UnauthorizedException('La sesión venció o es inválida.');
    }
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
