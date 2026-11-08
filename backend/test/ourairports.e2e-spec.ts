import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AdministracionAeropuertosController } from '../src/airports/administracion-aeropuertos.controller.js';
import { AirportsService } from '../src/airports/airports.service.js';
import { RedisModule } from '../src/redis/redis.module.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { ValidationPipe } from '@nestjs/common';
import { CatalogIdentitiesController } from '../src/etl/catalog-identities.controller.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { EtlService } from '../src/etl/etl.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createDatabase } from '../src/prisma/db.js';
import type { PipelineConfiguration } from '../src/etl/interfaces/pipeline-configuration.js';

describe('OurAirports: ingesta de catálogo', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('reconcilia ambos catálogos, protege ediciones y resuelve ambigüedades por HTTP', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-oa-'));
    const file = join(directory, 'airports.csv');
    const sourceId = `fixture-${randomUUID()}`;
    const rollback = new Error('rollback OurAirports');
    try {
      await db.transaction(async (tx) => {
        const country = await tx.orm.public.Pais.firstOrThrow({
          codigoIso: 'PG',
        });
        const ofId = 1900000000 + Math.floor(Math.random() * 1000000);
        const airport = await tx.orm.public.Aeropuerto.create({
          idOpenflights: ofId,
          nombre: sourceId,
          nombrePais: country.nombre,
          paisId: country.id,
          icao: `9${randomUUID().slice(0, 3).toUpperCase()}`,
          iata: null,
          latitud: -6.1,
          longitud: 145,
          ubicacion: ubicacionAeropuerto(-6.1, 145),
          fuente: 'OpenFlights',
        });
        const module = await Test.createTestingModule({
          imports: [RedisModule],
          controllers: [
            AdministracionAeropuertosController,
            CatalogIdentitiesController,
          ],
          providers: [
            EtlService,
            AirportsService,
            { provide: getQueueToken('etl-queue'), useValue: {} },
            {
              provide: PrismaService,
              useValue: {
                models: tx.orm.public,
                db: {
                  raw: tx.raw,
                  query: tx.query.bind(tx),
                  execute: tx.execute.bind(tx),
                  transaction: async <T>(
                    work: (inner: typeof tx) => Promise<T>,
                  ) => work(tx),
                },
              },
            },
          ],
        })
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate(context: import('@nestjs/common').ExecutionContext) {
              context
                .switchToHttp()
                .getRequest<{ user: { rol: string } }>().user = {
                rol: 'ADMIN',
              };
              return true;
            },
          })
          .compile();
        const app = module.createNestApplication();
        app.useGlobalPipes(
          new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        );
        await app.init();
        const api = request(app.getHttpServer() as Server);
        const configuration: PipelineConfiguration = {
          conexion: {
            tipoFuente: 'http_stream',
            urlEndpoint:
              'https://davidmegginson.github.io/ourairports-data/airports.csv',
            metodoHttp: 'GET',
            formatoDatos: 'csv',
            csvConCabecera: true,
            proveedor: 'ourairports',
          },
          mapeoEsquema: [],
          configuracionProgramacion: {
            expresionCron: '',
            tamanoLote: 1000,
            tiempoLimiteSegundos: 60,
            maximoReintentos: 2,
          },
        };
        await writeFile(
          file,
          `id,ident,type,name,latitude_deg,longitude_deg,iso_country,municipality,icao_code,iata_code\n${sourceId},${airport.icao},large_airport,OurAirports fixture,-6,145,PG,Goroka,${airport.icao},${airport.iata}\n`,
        );
        try {
          const service = module.get(EtlService);
          expect(
            await service.importCatalog(
              'aeropuertos',
              file,
              undefined,
              configuration,
            ),
          ).toMatchObject({ processed: 1, discarded: 0 });
          const updated = (
            await api
              .get(`/administracion/aeropuertos/${airport.id}`)
              .expect(200)
          ).body as Record<string, unknown>;
          expect(updated).toMatchObject({
            idOpenflights: ofId,
            nombre: 'OurAirports fixture',
            fuente: 'OurAirports',
            latitud: -6,
          });
          await api
            .patch(`/administracion/aeropuertos/${airport.id}`)
            .send({ nombre: 'Edición protegida' })
            .expect(200);
          await service.importCatalog(
            'aeropuertos',
            file,
            undefined,
            configuration,
          );
          expect(
            (
              await api
                .get(`/administracion/aeropuertos/${airport.id}`)
                .expect(200)
            ).body,
          ).toMatchObject({ nombre: 'Edición protegida' });
          const reverseId = `!reverse-${sourceId}`;
          const reverseIcao = `8${randomUUID().slice(0, 3).toUpperCase()}`;
          await writeFile(
            file,
            `id,ident,type,name,latitude_deg,longitude_deg,iso_country,municipality,icao_code,iata_code\n${reverseId},${reverseIcao},large_airport,OurAirports primero,-6,145,PG,Goroka,${reverseIcao},\n`,
          );
          await service.importCatalog(
            'aeropuertos',
            file,
            undefined,
            configuration,
          );
          const beforeOpenFlights = (
            await api
              .get(`/administracion/aeropuertos`)
              .query({ busqueda: 'OurAirports primero' })
              .expect(200)
          ).body;
          const reverseOfId = ofId - 1000000;
          await writeFile(
            file,
            `${reverseOfId},"OpenFlights después","Goroka","${country.nombre}",\\N,"${reverseIcao}",-7,145,0,0,"U","UTC","airport","OpenFlights"\n`,
          );
          await service.importCatalog('aeropuertos', file);
          const afterOpenFlights = (
            await api
              .get(`/administracion/aeropuertos`)
              .query({ busqueda: 'OurAirports primero' })
              .expect(200)
          ).body;
          const first = beforeOpenFlights as {
            datos: { id: string }[];
            total: number;
          };
          expect(first.total).toBe(1);
          expect(afterOpenFlights).toMatchObject({
            total: 1,
            datos: [expect.objectContaining({ id: first.datos[0].id })],
          });
          expect(
            (
              await api
                .get(`/administracion/aeropuertos/${first.datos[0].id}`)
                .expect(200)
            ).body,
          ).toMatchObject({
            idOpenflights: reverseOfId,
            latitud: -6,
            fuente: 'OurAirports',
          });
          const conflictIcao = `7${randomUUID().slice(0, 3).toUpperCase()}`;
          await writeFile(
            file,
            `id,ident,type,name,latitude_deg,longitude_deg,iso_country,municipality,icao_code,iata_code\n!double-${sourceId},${conflictIcao},large_airport,Doble OpenFlights,-6,145,PG,Goroka,${conflictIcao},\n`,
          );
          await service.importCatalog(
            'aeropuertos',
            file,
            undefined,
            configuration,
          );
          const pair = [reverseOfId - 1, reverseOfId - 2];
          await writeFile(
            file,
            pair
              .map(
                (id) =>
                  `${id},"OpenFlights en conflicto","Goroka","${country.nombre}",\\N,"${conflictIcao}",-7,145,0,0,"U","UTC","airport","OpenFlights"`,
              )
              .join('\n') + '\n',
          );
          await service.importCatalog('aeropuertos', file);
          for (const id of pair) {
            const pendingPair = await api
              .get('/administracion/fuentes/identidades')
              .query({ busqueda: String(id) })
              .expect(200);
            expect(pendingPair.body).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  fuente: 'OpenFlights',
                  identificador: String(id),
                  aeropuertoId: null,
                }),
              ]),
            );
          }
          const noDuplicate = await api
            .get('/administracion/aeropuertos')
            .query({ busqueda: conflictIcao })
            .expect(200);
          expect(noDuplicate.body).toMatchObject({
            total: 1,
            datos: [
              expect.objectContaining({ idOpenflights: null, latitud: -6 }),
            ],
          });
          await api
            .post('/administracion/aeropuertos')
            .send({
              nombre: 'Coincidencia ambigua OurAirports',
              paisId: airport.paisId,
              icao: airport.icao,
              latitud: -6,
              longitud: 145,
            })
            .expect(201);
          const pendingId = `!${sourceId}`;
          await writeFile(
            file,
            `id,ident,type,name,latitude_deg,longitude_deg,iso_country,municipality,icao_code,iata_code\n${pendingId},${airport.icao},large_airport,Pendiente OurAirports,-6,145,PG,Goroka,${airport.icao},${airport.iata}\n`,
          );
          await service.importCatalog(
            'aeropuertos',
            file,
            undefined,
            configuration,
          );
          const pending = await api
            .get('/administracion/fuentes/identidades')
            .query({ busqueda: pendingId })
            .expect(200);
          expect(pending.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                identificador: pendingId,
                aeropuertoId: null,
              }),
            ]),
          );
          await api
            .patch(
              `/administracion/fuentes/identidades/OurAirports/${encodeURIComponent(pendingId)}`,
            )
            .send({ aeropuertoId: airport.id })
            .expect(200);
          const resolved = await api
            .get('/administracion/fuentes/identidades')
            .query({ busqueda: pendingId })
            .expect(200);
          expect(resolved.body).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({ identificador: pendingId }),
            ]),
          );
          expect(
            (
              await api
                .get(`/administracion/aeropuertos/${airport.id}`)
                .expect(200)
            ).body,
          ).toMatchObject({ nombre: 'Edición protegida' });
        } finally {
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
