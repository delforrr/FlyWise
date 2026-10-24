import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuthController } from './auth.controller.js';
import { RefreshSessionsService } from './refresh-sessions.service.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { LocalStrategy } from './local.strategy.js';
import { UsersController } from '../users/users.controller.js';
import { UsersService } from '../users/users.service.js';
import { RedisService } from '../redis/redis.service.js';

describe('Authentication and user permissions (HTTP)', () => {
  let app: INestApplication<App>;
  let auth: AuthService;
  let jwt: JwtService;
  const operator = {
    id: 'operator',
    email: 'operator@example.test',
    role: 'OPERATOR' as const,
  };
  const admin = {
    id: 'admin',
    email: 'admin@example.test',
    role: 'ADMIN' as const,
  };
  const users = {
    getUserById: jest.fn((id: string) =>
      Promise.resolve(id === 'admin' ? admin : operator),
    ),
    getUsers: jest.fn().mockResolvedValue([]),
    createUser: jest.fn().mockResolvedValue(operator),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: 'test-only-secret' }),
      ],
      controllers: [AuthController, UsersController],
      providers: [
        AuthService,
        {
          provide: RefreshSessionsService,
          useValue: {
            revoke: jest.fn(),
            create: jest.fn().mockResolvedValue({
              sessionId: 'test-session',
              refreshToken: 'refresh',
              remember: false,
              expiresAt: Date.now() + 60000,
            }),
          },
        },
        LocalStrategy,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: 'test-only-secret' }),
        },
        { provide: UsersService, useValue: users },
        {
          provide: RedisService,
          useValue: { get: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    auth = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects a public attempt to register an administrator', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'attacker@example.test',
        password: 'password123',
        role: 'ADMIN',
      })
      .expect(400);
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it.each(['get', 'post', 'patch', 'delete'] as const)(
    'blocks an operator from user management: %s',
    async (method) => {
      const url =
        method === 'patch' || method === 'delete'
          ? '/users/00000000-0000-4000-8000-000000000001'
          : '/users';
      await request(app.getHttpServer())
        [method](url)
        .set(
          'Authorization',
          `Bearer ${jwt.sign({ sub: operator.id, ...operator }, { audience: 'access' })}`,
        )
        .send({})
        .expect(403);
    },
  );

  it('lets an administrator list users', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: admin.id, ...admin }, { audience: 'access' })}`,
      )
      .expect(200, []);
  });

  it('validates login input before asking Passport to authenticate', async () => {
    const validate = jest
      .spyOn(auth, 'validateUser')
      .mockResolvedValue(operator);
    try {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: { invalid: true }, password: ['password123'] })
        .expect(400);
      expect(validate).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: ' OPERATOR@example.test ', password: 'password123' })
        .expect(200);
      expect(validate).toHaveBeenCalledWith(operator.email, 'password123');
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: operator.email, password: 'password123', unknown: true })
        .expect(400);
    } finally {
      validate.mockRestore();
    }
  });
});
