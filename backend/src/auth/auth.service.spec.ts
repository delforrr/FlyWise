import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/interfaces/users.interface';
import { UserDto } from '../users/dto/user.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;

  const mockUser: User = {
    id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    email: 'admin@flywise.com',
    passwordHash: '',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserDto: UserDto = {
    id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    email: 'admin@flywise.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('secretPassword', 10);

    const mockUsersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      getUserById: jest.fn().mockResolvedValue(mockUserDto),
    };

    const mockJwtService = {
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
        email: 'admin@flywise.com',
        role: 'ADMIN',
        createdAt: mockUser.createdAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
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
        email: 'new@flywise.com',
        password: 'pass',
      };
      usersService.createUser.mockResolvedValue(mockUserDto);

      const result = await service.register(createDto);
      expect(usersService.createUser).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('login', () => {
    it('should sign a JWT token with username and sub payload', () => {
      const result = service.login(mockUserDto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUserDto.id,
        email: mockUserDto.email,
        role: mockUserDto.role,
      });
      expect(result).toEqual({
        access_token: 'mocked.jwt.token',
        accessToken: 'mocked.jwt.token',
        token_type: 'bearer',
        user: {
          id: mockUserDto.id,
          email: mockUserDto.email,
          role: mockUserDto.role,
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

  describe('logout & isTokenRevoked', () => {
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
