import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshSessionsService } from './refresh-sessions.service.js';
import { LocalStrategy } from './local.strategy.js';
import { JwtStrategy } from './jwt.strategy.js';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';

const profile = {
  id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
  email: 'session-test@flywise.example',
  role: 'ADMIN',
};

describe('sesión HTTP completa', () => {
  let app: INestApplication<Server>;
  let server: Server;
  let jwt: JwtService;
  let redis: RedisService;
  const sessions: string[] = [];
  const headers = { 'X-FlyWise-Session': '1', Origin: 'http://localhost:3000' };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-only-http-secret' })],
      controllers: [AuthController],
      providers: [
        AuthService,
        RefreshSessionsService,
        RedisService,
        LocalStrategy,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET: 'test-only-http-secret',
            NODE_ENV: 'test',
          }),
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: (email: string) =>
              Promise.resolve(
                email === profile.email
                  ? {
                      ...profile,
                      passwordHash,
                      createdAt: '2026-10-24 00:00:00',
                    }
                  : null,
              ),
            getUserById: () => Promise.resolve(profile),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();
    jwt = app.get(JwtService);
    redis = app.get(RedisService);
  });
  afterEach(async () => {
    if (sessions.length)
      await redis
        .getClient()
        .del(...sessions.splice(0).map((id) => `refresh:${id}`));
  });
  afterAll(async () => {
    await app.close();
  });

  async function login(remember = true) {
    const result = await request(server)
      .post('/api/auth/login')
      .set(headers)
      .send({ email: profile.email, password: 'Password123!', remember })
      .expect(200);
    const body = result.body as { accessToken: string };
    sessions.push(jwt.verify<{ sid: string }>(body.accessToken).sid);
    return { ...result, body };
  }

  it('login → validación SSR → rotación → logout rechaza todos los tokens anteriores', async () => {
    const first = await login();
    const cookie = first.headers['set-cookie'][0].split(';')[0];
    expect(first.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(first.headers['set-cookie'][0]).toMatch(/Max-Age=/);
    const access = jwt.verify<{ sid: string; exp: number; iat: number }>(
      first.body.accessToken,
      { audience: 'access' },
    );
    expect(access.exp - access.iat).toBe(900);
    expect(first.body).not.toHaveProperty('refreshToken');
    const ssr = await request(server)
      .get('/api/auth/session')
      .set(headers)
      .set('Cookie', cookie)
      .expect(200);
    expect((ssr.body as { id: string }).id).toBe(profile.id);
    expect(ssr.body).not.toHaveProperty('accessToken');
    expect(ssr.headers['set-cookie']).toBeUndefined();
    const next = await request(server)
      .post('/api/auth/refresh')
      .set(headers)
      .set('Cookie', cookie)
      .expect(200);
    const nextCookie = next.headers['set-cookie'][0].split(';')[0];
    const nextToken = (next.body as { accessToken: string }).accessToken;
    expect(nextCookie).not.toBe(cookie);
    await request(server)
      .get('/api/auth/me')
      .auth(nextToken, { type: 'bearer' })
      .expect(200);
    // Un refresh token nunca debe servir como JWT de acceso.
    await request(server)
      .get('/api/auth/me')
      .auth(nextCookie.split('=')[1], { type: 'bearer' })
      .expect(401);
    const expired = jwt.sign(
      { sub: profile.id, sid: access.sid },
      { audience: 'access', expiresIn: -1 },
    );
    const logout = await request(server)
      .post('/api/auth/logout')
      .set(headers)
      .set('Cookie', nextCookie)
      .auth(expired, { type: 'bearer' })
      .expect(200);
    expect(logout.headers['set-cookie'][0]).toContain('refresh_token=;');
    await request(server)
      .post('/api/auth/refresh')
      .set(headers)
      .set('Cookie', nextCookie)
      .expect(401);
    await request(server)
      .get('/api/auth/me')
      .auth(first.body.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .get('/api/auth/me')
      .auth(nextToken, { type: 'bearer' })
      .expect(401);
  });

  it('sin remember usa cookie de sesión; replay revoca la familia', async () => {
    const first = await login(false);
    expect(first.headers['set-cookie'][0]).not.toMatch(/Max-Age=|Expires=/);
    const cookie = first.headers['set-cookie'][0].split(';')[0];
    const next = await request(server)
      .post('/api/auth/refresh')
      .set(headers)
      .set('Cookie', cookie)
      .expect(200);
    const nextToken = (next.body as { accessToken: string }).accessToken;
    await request(server)
      .post('/api/auth/refresh')
      .set(headers)
      .set('Cookie', cookie)
      .expect(401);
    await request(server)
      .get('/api/auth/me')
      .auth(nextToken, { type: 'bearer' })
      .expect(401);
  });

  it('rechaza credenciales incorrectas, remember inválido, origen externo y falta de cookie', async () => {
    await request(server)
      .post('/api/auth/login')
      .set(headers)
      .send({
        email: profile.email,
        password: 'wrong-password',
        remember: true,
      })
      .expect(401);
    await request(server)
      .post('/api/auth/login')
      .set(headers)
      .send({
        email: profile.email,
        password: 'Password123!',
        remember: 'false',
      })
      .expect(400);
    await request(server)
      .post('/api/auth/login')
      .set({ ...headers, Origin: 'https://attacker.example' })
      .send({ email: profile.email, password: 'Password123!' })
      .expect(403);
    await request(server).post('/api/auth/refresh').set(headers).expect(401);
    await request(server).post('/api/auth/refresh').expect(403);
  });
});
