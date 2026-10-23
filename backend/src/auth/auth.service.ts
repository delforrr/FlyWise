import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserDto } from '../users/dto/user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
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
        createdAt: user.createdAt,
      };
    }

    return null;
  }

  async register(createUserDto: CreateUserDto): Promise<UserDto> {
    return this.usersService.createUser(createUserDto);
  }

  login(user: UserDto) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);
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

  async logout(token: string): Promise<void> {
    try {
      const decoded: unknown = this.jwtService.decode(token);
      let exp: number | undefined;
      if (
        decoded &&
        typeof decoded === 'object' &&
        'exp' in decoded &&
        typeof (decoded as Record<string, unknown>).exp === 'number'
      ) {
        exp = (decoded as { exp: number }).exp;
      }
      const now = Math.floor(Date.now() / 1000);
      const ttl = exp ? Math.max(exp - now, 0) : 3600;
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${token}`, 'revoked', ttl);
      }
      this.logger.log('Token invalidado en Redis exitosamente');
    } catch (err: unknown) {
      this.logger.warn(`Error al invalidar token en Redis: ${String(err)}`);
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const result = await this.redisService.get(`blacklist:${token}`);
      return Boolean(result);
    } catch {
      return false;
    }
  }
}
