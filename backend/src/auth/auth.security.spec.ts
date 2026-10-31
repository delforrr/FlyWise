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
    correo: 'operator@example.test',
    rol: 'OPERATOR' as const,
  };
  const admin = {
    id: 'admin',
    correo: 'admin@example.test',
    rol: 'ADMIN' as const,
  };
  const usuarios = {
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
        { provide: UsersService, useValue: usuarios },
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

  it('rejects a public intento to register an administrator', async () => {
    await request(app.getHttpServer())
      .post('/autenticacion/registrar')
      .send({
        correo: 'attacker@example.test',
        password: 'password123',
        rol: 'ADMIN',
      })
      .expect(400);
    expect(usuarios.createUser).not.toHaveBeenCalled();
  });

  it.each(['get', 'post', 'patch', 'delete'] as const)(
    'blocks an operator from user management: %s',
    async (method) => {
      const url =
        method === 'patch' || method === 'delete'
          ? '/usuarios/00000000-0000-4000-8000-000000000001'
          : '/usuarios';
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

  it('lets an administrator list usuarios', async () => {
    await request(app.getHttpServer())
      .get('/usuarios')
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
        .post('/autenticacion/iniciar-sesion')
        .send({ correo: { invalid: true }, password: ['password123'] })
        .expect(400);
      expect(validate).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .post('/autenticacion/iniciar-sesion')
        .send({ username: ' OPERATOR@example.test ', password: 'password123' })
        .expect(200);
      expect(validate).toHaveBeenCalledWith(operator.correo, 'password123');
      await request(app.getHttpServer())
        .post('/autenticacion/iniciar-sesion')
        .send({
          correo: operator.correo,
          password: 'password123',
          unknown: true,
        })
        .expect(400);
    } finally {
      validate.mockRestore();
    }
  });
});
