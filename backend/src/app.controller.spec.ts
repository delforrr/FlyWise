import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('no expone el endpoint de ejemplo en la raíz de la API', async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    const app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    await app.init();
    try {
      await request(app.getHttpServer()).get('/api').expect(404);
    } finally {
      await app.close();
    }
  });
});
