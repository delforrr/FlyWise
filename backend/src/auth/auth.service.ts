import { randomUUID } from 'node:crypto';
import { RefreshSessionsService } from './refresh-sessions.service.js';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { timestampToDate } from '../prisma/timestamp.js';
import { UserDto } from '../users/dto/user.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly sessions: RefreshSessionsService,
  ) {}

  async validateUser(email: string, pass: string): Promise<UserDto | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (isMatch) {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: timestampToDate(user.createdAt),
      };
    }

    return null;
  }

  async register(createUserDto: CreateUserDto): Promise<UserDto> {
    return this.usersService.createUser({ ...createUserDto, role: 'OPERATOR' });
  }

  login(user: UserDto, sessionId?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(sessionId ? { sid: sessionId } : {}),
    };
    const token = this.jwtService.sign(payload, {
      audience: 'access',
      expiresIn: '15m',
      jwtid: randomUUID(),
    });
    return {
      accessToken: token,
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string): Promise<UserDto> {
    return this.usersService.getUserById(userId);
  }

  async createSession(
    user: UserDto,
    remember: boolean,
    previousToken?: string,
  ) {
    await this.sessions.revoke(previousToken);
    const session = await this.sessions.create(user.id, remember);
    return { ...session, response: this.login(user, session.sessionId) };
  }

  async getSession(token?: string) {
    const payload = await this.sessions.inspect(token);
    try {
      return await this.getProfile(payload.sub);
    } catch (cause: unknown) {
      if (cause instanceof NotFoundException)
        throw new UnauthorizedException('La cuenta ya no existe.');
      throw cause;
    }
  }

  async refresh(token?: string) {
    const payload = await this.sessions.inspect(token, true);
    let user: UserDto;
    try {
      user = await this.getProfile(payload.sub);
    } catch (cause: unknown) {
      if (cause instanceof NotFoundException) {
        await this.sessions.revoke(token);
        throw new UnauthorizedException('La cuenta ya no existe.');
      }
      throw cause;
    }
    const session = await this.sessions.rotate(token);
    return { ...session, response: this.login(user, session.sessionId) };
  }

  async logout(token?: string, refreshToken?: string): Promise<void> {
    await this.sessions.revoke(refreshToken);
    if (!token) return;
    let payload: { sid?: string; exp?: number };
    try {
      payload = this.jwtService.verify(token, {
        audience: 'access',
        algorithms: ['HS256'],
        ignoreExpiration: true,
      });
    } catch {
      return;
    }
    if (payload.sid) {
      await this.sessions.revokeId(payload.sid);
      return;
    }
    const ttl = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
    try {
      if (ttl > 0)
        await this.redisService.set(`blacklist:${token}`, 'revoked', ttl);
    } catch {
      throw new ServiceUnavailableException('No se pudo revocar la sesión');
    }
    this.logger.log('Sesión revocada.');
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      return Boolean(await this.redisService.get(`blacklist:${token}`));
    } catch {
      throw new ServiceUnavailableException('No se pudo verificar la sesión');
    }
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    return this.sessions.isActive(sessionId);
  }
}
