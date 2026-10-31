import { RefreshSessionsService } from './refresh-sessions.service.js';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service.js';
import { Usuario } from '../users/interfaces/users.interface.js';
import { UserDto } from '../users/dto/user.dto.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let sessions: jest.Mocked<RefreshSessionsService>;
  let redisService: jest.Mocked<RedisService>;

  const mockUser: Usuario = {
    id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    correo: 'admin@flywise.com',
    hashContrasena: '',
    rol: 'ADMIN',
    creadoEn: '2026-10-24 00:00:00' as Usuario['creadoEn'],
    actualizadoEn: '2026-10-24 00:00:00' as Usuario['actualizadoEn'],
  };

  const mockUserDto: UserDto = {
    id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    correo: 'admin@flywise.com',
    rol: 'ADMIN',
  };

  beforeEach(async () => {
    mockUser.hashContrasena = await bcrypt.hash('secretPassword', 10);

    const mockUsersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      getUserById: jest.fn().mockResolvedValue(mockUserDto),
    };

    const mockJwtService = {
      verify: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      sign: jest.fn().mockReturnValue('mocked.jwt.token'),
      decode: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };

    const mockRedisService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: RefreshSessionsService,
          useValue: {
            inspect: jest.fn().mockResolvedValue({ sub: mockUserDto.id }),
            rotate: jest.fn().mockResolvedValue({ sessionId: 'session-1' }),
            revoke: jest.fn(),
            revokeId: jest.fn(),
            isActive: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    redisService = module.get(RedisService);
    sessions = module.get(RefreshSessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'admin@flywise.com',
        'secretPassword',
      );
      expect(result).toEqual({
        id: mockUser.id,
        correo: 'admin@flywise.com',
        rol: 'ADMIN',
        creadoEn: new Date('2026-10-24T00:00:00Z'),
      });
      expect(result).not.toHaveProperty('hashContrasena');
    });

    it('should return null when password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'admin@flywise.com',
        'wrongPassword',
      );
      expect(result).toBeNull();
    });

    it('should return null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('unknown@flywise.com', 'any');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should create and return the user through usersService', async () => {
      const createDto: CreateUserDto = {
        correo: 'new@flywise.com',
        password: 'pass',
      };
      usersService.createUser.mockResolvedValue(mockUserDto);

      const result = await service.register(createDto);
      expect(usersService.createUser).toHaveBeenCalledWith({
        ...createDto,
        rol: 'OPERATOR',
      });
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('login', () => {
    it('should sign a JWT token with username and sub payload', () => {
      const result = service.login(mockUserDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUserDto.id,
          correo: mockUserDto.correo,
          rol: mockUserDto.rol,
        },
        expect.objectContaining({
          audience: 'access',
          expiresIn: '15m',
          jwtid: expect.any(String),
        }),
      );
      expect(result).toEqual({
        access_token: 'mocked.jwt.token',
        accessToken: 'mocked.jwt.token',
        token_type: 'bearer',
        user: {
          id: mockUserDto.id,
          correo: mockUserDto.correo,
          rol: mockUserDto.rol,
        },
      });
    });
  });

  describe('getProfile', () => {
    it('should return the user profile by id', async () => {
      const result = await service.getProfile(mockUserDto.id);
      expect(usersService.getUserById).toHaveBeenCalledWith(mockUserDto.id);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('refresh', () => {
    it('no consume el refresh token si falla temporalmente la base de datos', async () => {
      usersService.getUserById.mockRejectedValueOnce(
        new Error('DB unavailable'),
      );
      await expect(service.refresh('refresh-token')).rejects.toThrow(
        'DB unavailable',
      );
      expect(sessions.rotate).not.toHaveBeenCalled();
      expect(sessions.revoke).not.toHaveBeenCalled();
    });
    it('revoca la sesión si se eliminó la cuenta y usa los datos actuales al renovar', async () => {
      usersService.getUserById.mockRejectedValueOnce(new NotFoundException());
      await expect(service.refresh('refresh-token')).rejects.toThrow('cuenta');
      expect(sessions.revoke).toHaveBeenCalledWith('refresh-token');
      expect(sessions.rotate).not.toHaveBeenCalled();
      const response = await service.refresh('refresh-token');
      expect(response.response.user).toEqual(mockUserDto);
      expect(jwtService.sign).toHaveBeenLastCalledWith(
        expect.objectContaining({ sid: 'session-1' }),
        expect.any(Object),
      );
    });
  });

  describe('logout & isTokenRevoked', () => {
    it('fails closed if Redis cannot verify or revoke a token', async () => {
      redisService.get.mockRejectedValueOnce(new Error('Redis unavailable'));
      await expect(service.isTokenRevoked('sample.token')).rejects.toThrow(
        'verificar',
      );
      redisService.set.mockRejectedValueOnce(new Error('Redis unavailable'));
      await expect(service.logout('sample.token')).rejects.toThrow('revocar');
    });

    it('should store revoked token in redis with TTL', async () => {
      await service.logout('sample.token');
      expect(redisService.set).toHaveBeenCalledWith(
        'blacklist:sample.token',
        'revoked',
        expect.any(Number),
      );
    });

    it('should return true if token is in redis blacklist', async () => {
      redisService.get.mockResolvedValueOnce('revoked');
      const isRevoked = await service.isTokenRevoked('sample.token');
      expect(isRevoked).toBe(true);
    });

    it('should return false if token is not in redis blacklist', async () => {
      redisService.get.mockResolvedValueOnce(null);
      const isRevoked = await service.isTokenRevoked('sample.token');
      expect(isRevoked).toBe(false);
    });
  });
});
