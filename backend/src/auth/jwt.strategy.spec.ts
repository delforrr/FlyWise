import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const mockAuthService = {
      isTokenRevoked: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate and return user payload when token is active', async () => {
    const mockReq = {
      headers: {
        authorization: 'Bearer active.valid.token',
      },
    };
    const payload = {
      sub: 'user-uuid',
      email: 'admin@flywise.com',
      role: 'ADMIN' as const,
    };

    const result = await strategy.validate(mockReq, payload);
    expect(result).toEqual({
      id: 'user-uuid',
      email: 'admin@flywise.com',
      role: 'ADMIN',
    });
  });

  it('should throw UnauthorizedException when token is revoked in redis', async () => {
    authService.isTokenRevoked.mockResolvedValueOnce(true);
    const mockReq = {
      headers: {
        authorization: 'Bearer revoked.token',
      },
    };
    const payload = {
      sub: 'user-uuid',
      email: 'admin@flywise.com',
      role: 'ADMIN' as const,
    };

    await expect(strategy.validate(mockReq, payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
