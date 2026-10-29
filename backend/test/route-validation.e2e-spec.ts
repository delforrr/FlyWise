import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RoutesService } from '../src/routes/routes.service.js';
import { RoutesController } from '../src/routes/routes.controller.js';

describe('Route identity validation (HTTP and PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('normalizes IATA/ICAO, rejects equal endpoints and returns a real direct route', async () => {
    const rollback = new Error('rollback route fixtures');
    try {
      await db.transaction(async tx => {
        const origin = await tx.orm.public.Airport.create({ name: 'Identity origin', iata: 'QVA', icao: 'ZQVA', countryName: 'Test', latitude: 0, longitude: 0 });
        const destination = await tx.orm.public.Airport.create({ name: 'Identity destination', iata: 'QVB', icao: 'ZQVB', countryName: 'Test', latitude: 1, longitude: 1 });
        await tx.orm.public.Route.create({ originId: origin.id, destinationId: destination.id });
        const module = await Test.createTestingModule({ controllers: [RoutesController], providers: [RoutesService, { provide: PrismaService, useValue: { models: tx.orm.public, db: tx } }] }).compile();
        const app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        try {
          await request(app.getHttpServer()).get('/routes/direct').query({ origin: 'PKN', destination: ' pkn ' }).expect(400);
          await request(app.getHttpServer()).get('/routes/direct').query({ origin: 'QVA', destination: 'ZQVA' }).expect(400);
          await request(app.getHttpServer()).get('/routes/direct').query({ origin: '???', destination: 'QVB' }).expect(400);
          await request(app.getHttpServer()).get('/routes/explore').query({ originId: origin.id, destinationId: origin.id }).expect(400);
          const response = await request(app.getHttpServer()).get('/routes/direct').query({ origin: ' zqva ', destination: 'qvb' }).expect(200);
          expect(response.body).toMatchObject({ origin: { iata: 'QVA' }, destination: { iata: 'QVB' } });
        } finally { await app.close(); }
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  });
});
