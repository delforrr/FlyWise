import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy.js';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    const mockAuthService = {
      isTokenRevoked: jest.fn().mockResolvedValue(false),
      isSessionActive: jest.fn().mockResolvedValue(true),
      getProfile: jest.fn().mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@flywise.com',
        role: 'ADMIN',
      }),
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

  it('rejects an access token after its refresh session was revoked', async () => {
    authService.isSessionActive.mockResolvedValueOnce(false);
    await expect(
      strategy.validate(
        { headers: {} },
        {
          sub: 'user-uuid',
          email: 'admin@flywise.com',
          sid: 'revoked-session',
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(authService.getProfile).not.toHaveBeenCalled();
  });

  it('uses the current role instead of the role saved in an old token', async () => {
    authService.getProfile.mockResolvedValueOnce({
      id: 'user-uuid',
      email: 'admin@flywise.com',
      role: 'OPERATOR',
    });
    const user = await strategy.validate(
      { headers: { authorization: 'Bearer old.token' } },
      { sub: 'user-uuid', email: 'admin@flywise.com', role: 'ADMIN' },
    );
    expect(user.role).toBe('OPERATOR');
  });

  it('rejects tokens belonging to deleted accounts', async () => {
    authService.getProfile.mockRejectedValueOnce(new NotFoundException());
    await expect(
      strategy.validate(
        { headers: { authorization: 'Bearer old.token' } },
        { sub: 'user-uuid', email: 'admin@flywise.com' },
      ),
    ).rejects.toThrow(UnauthorizedException);
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
