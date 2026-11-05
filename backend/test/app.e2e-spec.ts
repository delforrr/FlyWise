import { PerformanceInterceptor } from '../src/common/interceptors/performance.interceptor.js';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new PerformanceInterceptor());
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET) sends the response without setting headers twice', async () => {
    const response = await request(app.getHttpServer())
      .get('/salud')
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        estado: 'ok',
        services: { database: 'up', redis: 'up' },
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
