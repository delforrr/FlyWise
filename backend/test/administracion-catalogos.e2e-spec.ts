import type { Server } from 'node:http';
import type { AirportsService } from '../src/airports/airports.service.js';
import type { AirlinesService } from '../src/airlines/airlines.service.js';
import type { RoutesService } from '../src/routes/routes.service.js';
import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { AirportsModule } from '../src/airports/airports.module.js';
import { AirlinesModule } from '../src/airlines/airlines.module.js';
import { RoutesModule } from '../src/routes/routes.module.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';

describe('Administración de catálogos (PostgreSQL y HTTP)', () => {
  const db = createDatabase();
  let rol: 'ADMIN' | 'OPERATOR' | null = 'ADMIN';
  afterAll(() => db.close());

  async function aislado(
    trabajo: (app: INestApplication<Server>, tx: Transaction) => Promise<void>,
  ) {
    const rollback = new Error('rollback administración');
    try {
      await db.transaction(async (tx) => {
        const module = await Test.createTestingModule({
          imports: [PrismaModule, AirportsModule, AirlinesModule, RoutesModule],
        })
          .overrideProvider(PrismaService)
          .useValue({
            models: tx.orm.public,
            db: {
              raw: tx.raw,
              query: tx.query.bind(tx),
              execute: tx.execute.bind(tx),
              transaction: async <T>(
                work: (inner: Transaction) => Promise<T>,
              ) => work(tx),
            },
          })
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate: (context: ExecutionContext) => {
              if (!rol) throw new UnauthorizedException();
              context
                .switchToHttp()
                .getRequest<{ user: { id: string; rol: string } }>().user = {
                id: randomUUID(),
                rol,
              };
              return true;
            },
          })
          .compile();
        const app = module.createNestApplication<INestApplication<Server>>();
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
          }),
        );
        await app.init();
        try {
          await trabajo(app, tx);
        } finally {
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it('exige autenticación y rol administrador en los tres CRUD', async () => {
    await aislado(async (app) => {
      for (const recurso of ['aeropuertos', 'aerolineas', 'rutas']) {
        rol = null;
        await request(app.getHttpServer())
          .get(`/administracion/${recurso}`)
          .expect(401);
        rol = 'OPERATOR';
        for (const metodo of ['get', 'post', 'patch', 'delete'] as const) {
          const url = `/administracion/${recurso}${metodo === 'patch' || metodo === 'delete' ? '/' + randomUUID() : ''}`;
          await request(app.getHttpServer())[metodo](url).expect(403);
        }
      }
    });
  });

  it('crea, consulta, edita y archiva sin perder relaciones; valida entradas y conserva cambios parciales', async () => {
    rol = 'ADMIN';
    await aislado(async (app, tx) => {
      const api = request(app.getHttpServer());
      const muestra = await tx.orm.public.Aeropuerto.firstOrThrow({
        idOpenflights: 1,
      });
      const pais = await tx.orm.public.Pais.firstOrThrow({
        nombre: muestra.nombrePais,
      });
      const prefijo = `Administración %_ ${randomUUID()}`;
      const datos = {
        nombre: prefijo + ' origen',
        paisId: pais.id,
        ciudad: muestra.ciudad,
        latitud: muestra.latitud,
        longitud: muestra.longitud,
      };
      await api
        .post('/administracion/aeropuertos')
        .send({ ...datos, latitud: 91 })
        .expect(400);
      await api
        .post('/administracion/aeropuertos')
        .send({ ...datos, idOpenflights: 1 })
        .expect(400);
      const origen: Awaited<ReturnType<AirportsService['crearAdmin']>> = (
        await api.post('/administracion/aeropuertos').send(datos).expect(201)
      ).body;
      const destino: Awaited<ReturnType<AirportsService['crearAdmin']>> = (
        await api
          .post('/administracion/aeropuertos')
          .send({
            ...datos,
            nombre: prefijo + ' destino',
            latitud: 25,
            longitud: -80,
          })
          .expect(201)
      ).body;
      expect(origen).toMatchObject({
        nombrePais: pais.nombre,
        fuente: 'Administrativa',
        protegidoManualmente: true,
      });
      const listado: Awaited<ReturnType<AirportsService['listarAdmin']>> = (
        await api
          .get('/administracion/aeropuertos')
          .query({ busqueda: prefijo, limite: 1 })
          .expect(200)
      ).body;
      expect(listado).toMatchObject({ total: 2, pagina: 1, limite: 1 });
      expect(listado.datos).toHaveLength(1);
      await api
        .patch(`/administracion/aeropuertos/${origen.id}`)
        .send({ nombre: null })
        .expect(400);
      expect(
        (
          await api
            .patch(`/administracion/aeropuertos/${origen.id}`)
            .send({ nombre: prefijo + ' editado' })
            .expect(200)
        ).body,
      ).toMatchObject({ protegidoManualmente: true });
      expect(
        (
          await api
            .patch(`/administracion/aeropuertos/${origen.id}`)
            .send({ protegidoManualmente: false })
            .expect(200)
        ).body,
      ).toMatchObject({ protegidoManualmente: false });
      const aerolinea: Awaited<ReturnType<AirlinesService['crearAdmin']>> = (
        await api
          .post('/administracion/aerolineas')
          .send({
            nombre: prefijo + ' operadora',
            paisId: pais.id,
            activa: true,
          })
          .expect(201)
      ).body;
      await api.get(`/administracion/aerolineas/${aerolinea.id}`).expect(200);
      await api
        .patch(`/administracion/aerolineas/${aerolinea.id}`)
        .send({ activa: null })
        .expect(200);
      const tramo = { origenId: origen.id, destinoId: destino.id };
      await api
        .post('/administracion/rutas')
        .send({ ...tramo, destinoId: origen.id })
        .expect(400);
      const ruta: Awaited<ReturnType<RoutesService['crearAdmin']>> = (
        await api.post('/administracion/rutas').send(tramo).expect(201)
      ).body;
      // A savepoint lets this fixture continue after PostgreSQL rejects a duplicate.
      await tx.execute(
        tx.raw.sql`SAVEPOINT oferta_duplicada`.affectedCount().build(),
      );
      await api.post('/administracion/rutas').send(tramo).expect(409);
      await tx.execute(
        tx.raw.sql`ROLLBACK TO SAVEPOINT oferta_duplicada`
          .affectedCount()
          .build(),
      );
      await tx.execute(
        tx.raw.sql`RELEASE SAVEPOINT oferta_duplicada`.affectedCount().build(),
      );
      const urlOfertas = `/administracion/rutas/${ruta.id}/ofertas`;
      const oferta: Awaited<ReturnType<RoutesService['crearOferta']>> = (
        await api
          .post(urlOfertas)
          .send({
            aerolineaId: aerolinea.id,
            codigoCompartido: true,
            escalas: 2,
          })
          .expect(201)
      ).body;
      const segunda: Awaited<ReturnType<RoutesService['crearOferta']>> = (
        await api
          .post(urlOfertas)
          .send({
            aerolineaId: aerolinea.id,
            codigoAerolinea: 'ZZ',
            escalas: 0,
          })
          .expect(201)
      ).body;
      await api
        .patch(`${urlOfertas}/${oferta.id}`)
        .send({ escalas: null })
        .expect(400);
      const liberada = (
        await api
          .patch(`${urlOfertas}/${oferta.id}`)
          .send({ protegidoManualmente: false })
          .expect(200)
      ).body;
      expect(liberada).toMatchObject({
        codigoCompartido: true,
        escalas: 2,
        protegidoManualmente: false,
      });
      const otro: Awaited<ReturnType<AirportsService['crearAdmin']>> = (
        await api
          .post('/administracion/aeropuertos')
          .send({ ...datos, nombre: prefijo + ' otro' })
          .expect(201)
      ).body;
      await api
        .patch(`/administracion/rutas/${ruta.id}`)
        .send({ destinoId: otro.id })
        .expect(409);
      const movida: Awaited<ReturnType<RoutesService['detalleAdmin']>> = (
        await api.get(`/administracion/rutas/${ruta.id}`).expect(200)
      ).body;
      expect(movida.destinoId).toBe(destino.id);
      expect(movida.ofertas.map((f) => f.id).sort()).toEqual(
        [oferta.id, segunda.id].sort(),
      );
      expect(movida.ofertas.every((f) => f.aerolineaId === aerolinea.id)).toBe(
        true,
      );
      expect(
        (await tx.orm.public.Aeropuerto.firstOrThrow({ id: origen.id }))
          .cantidadRutas,
      ).toBe(1);
      expect(
        (await tx.orm.public.Aeropuerto.firstOrThrow({ id: destino.id }))
          .cantidadRutas,
      ).toBe(1);
      const vacia: Awaited<ReturnType<RoutesService['crearAdmin']>> = (
        await api
          .post('/administracion/rutas')
          .send({ origenId: destino.id, destinoId: origen.id })
          .expect(201)
      ).body;
      await api
        .patch(`/administracion/rutas/${vacia.id}`)
        .send({ origenId: otro.id })
        .expect(200);
      await api.delete(`${urlOfertas}/${segunda.id}`).expect(204);
      const detalle: Awaited<ReturnType<RoutesService['detalleAdmin']>> = (
        await api.get(`/administracion/rutas/${ruta.id}`).expect(200)
      ).body;
      expect(detalle.origen.id).toBe(origen.id);
      expect(detalle.destino.id).toBe(destino.id);
      expect(
        (await tx.orm.public.Aeropuerto.firstOrThrow({ id: origen.id }))
          .cantidadRutas,
      ).toBe(1);
      await api
        .delete(`/administracion/aerolineas/${aerolinea.id}`)
        .expect(204);
      expect(
        (await tx.orm.public.Aeropuerto.firstOrThrow({ id: origen.id }))
          .cantidadRutas,
      ).toBe(0);
      await api.delete(`/administracion/rutas/${ruta.id}`).expect(204);
      await api.delete(`/administracion/rutas/${ruta.id}`).expect(204);
      expect(
        (await api.get(`/administracion/rutas/${ruta.id}`).expect(200)).body,
      ).toMatchObject({ archivadoEn: expect.any(String) });
      await api.delete(`/administracion/aeropuertos/${origen.id}`).expect(204);
      await api
        .patch(`/administracion/aeropuertos/${origen.id}`)
        .send({ ciudad: 'Otra' })
        .expect(409);
      expect(
        (
          await api
            .get('/administracion/aeropuertos')
            .query({ busqueda: prefijo, estado: 'archivados' })
            .expect(200)
        ).body,
      ).toMatchObject({ total: 1 });
      expect(await tx.orm.public.Ruta.first({ id: ruta.id })).not.toBeNull();
      await api.get(`/administracion/rutas/${randomUUID()}`).expect(404);
      await api
        .get('/administracion/aeropuertos')
        .query({ limite: 1000 })
        .expect(400);
    });
  }, 15000);
});
