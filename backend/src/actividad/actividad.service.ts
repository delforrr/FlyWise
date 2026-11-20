import { timestampToJson } from '../prisma/timestamp.js';
import { FunctionCallExpr } from '@prisma/orm-postgres/relational-core/ast';
import { ExpressionImpl } from '@prisma/orm-postgres/relational-core/expression';
import { bloquearMesAnac } from '../prisma/bloqueo-transaccional.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import csv from 'csv-parser';
import { PrismaService } from '../prisma/prisma.service.js';
import { openCsvSource, validateSourceUrl } from '../etl/http-source.js';
import {
  ANAC_HEADERS,
  cabeceraAnac,
  fechaUtcAnac,
  normalizarMovimiento,
  type MovimientoAnac,
} from '../adapters/anac/anac.js';
import type {
  ConfiguracionAnacDto,
  ConsultaActividadDto,
  CorrespondenciaAnacDto,
} from './actividad.dto.js';

const SOURCE_HOST = 'datos.transporte.gob.ar';
export interface ConfiguracionAnac {
  fichaUrl: string;
  expresionCron: string;
  pausado: boolean;
}
export interface SnapshotAnac {
  conexion: { fichaUrl: string; periodo: string };
  mapeoEsquema: [];
  configuracionProgramacion: { maximoReintentos: number };
}

@Injectable()
export class ActividadService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('actividad-queue') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.programar(await this.configuracion());
  }

  async configuracion(): Promise<ConfiguracionAnac> {
    return this.prisma.models.ActividadAnacConfiguracion.select(
      'fichaUrl',
      'expresionCron',
      'pausado',
    ).firstOrThrow({ id: 'ANAC' });
  }

  async guardarConfiguracion(dto: ConfiguracionAnacDto) {
    this.validarFicha(dto.fichaUrl);
    await this.prisma.models.ActividadAnacConfiguracion.where({
      id: 'ANAC',
    }).update({
      fichaUrl: dto.fichaUrl,
      expresionCron: dto.expresionCron,
      pausado: dto.pausado,
    });
    await this.programar(dto);
    return dto;
  }

  private async programar(config: ConfiguracionAnac) {
    if (config.pausado) await this.queue.removeJobScheduler('ANAC');
    else
      await this.queue.upsertJobScheduler(
        'ANAC',
        { pattern: config.expresionCron, tz: 'UTC' },
        { name: 'anac-mensual', data: {} },
      );
  }

  private validarFicha(input: string) {
    const url = validateSourceUrl(input, [SOURCE_HOST]);
    if (
      url.hostname !== SOURCE_HOST ||
      !/^\/dataset\/[a-zA-Z0-9-]+\/(archivo|resource)\/[a-zA-Z0-9-]+\/?$/.test(
        url.pathname,
      )
    )
      throw new BadRequestException(
        'Se requiere la ficha oficial del recurso anual ANAC',
      );
    return url;
  }

  async ejecutar(periodo: string, solicitanteId?: string, programada = false) {
    const config = await this.configuracion();
    if (programada && config.pausado) return null;
    this.validarFicha(config.fichaUrl);
    return this.encolar(
      {
        conexion: { fichaUrl: config.fichaUrl, periodo },
        mapeoEsquema: [],
        configuracionProgramacion: { maximoReintentos: 2 },
      },
      solicitanteId,
    );
  }

  private async encolar(snapshot: SnapshotAnac, solicitanteId?: string) {
    const job = await this.prisma.models.EjecucionEtl.create({
      fuente: 'ANAC',
      estado: 'pending',
      solicitanteId,
      uriFuente: snapshot.conexion.fichaUrl,
      instantaneaConfiguracion: { ...snapshot },
    });
    try {
      await this.queue.add(
        'anac-importar',
        { ejecucionId: job.id },
        {
          jobId: job.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      );
    } catch {
      await this.prisma.models.EjecucionEtl.where({ id: job.id }).update({
        estado: 'failed',
        mensajeError: 'No fue posible encolar ANAC',
      });
      throw new BadRequestException('No fue posible encolar ANAC');
    }
    return { ejecucionId: job.id };
  }

  async reintentar(id: string, solicitanteId: string) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente: 'ANAC',
    });
    if (!job) throw new NotFoundException('Ejecución ANAC inexistente');
    if (!['completed', 'failed'].includes(job.estado))
      throw new ConflictException('La ejecución todavía está activa');
    const snapshot = job.instantaneaConfiguracion as unknown as SnapshotAnac;
    this.validarFicha(snapshot.conexion.fichaUrl);
    return this.encolar(snapshot, solicitanteId);
  }

  async descargar(fichaUrl: string) {
    this.validarFicha(fichaUrl);
    const connection = (urlEndpoint: string) => ({
      tipoFuente: 'http_stream' as const,
      urlEndpoint,
      metodoHttp: 'GET' as const,
      formatoDatos: 'csv' as const,
    });
    const response = await openCsvSource(connection(fichaUrl), 30, [
      SOURCE_HOST,
    ]);
    let body = '';
    for await (const chunk of response) {
      body += String(chunk);
      if (Buffer.byteLength(body) > 1024 * 1024) {
        response.destroy();
        throw new Error('Ficha ANAC demasiado grande');
      }
    }
    const resourceId = new URL(fichaUrl).pathname
      .split('/')
      .filter(Boolean)
      .at(-1)!;
    const links = [
      ...body.matchAll(/href=["']([^"']+\.csv(?:[^"']*)?)["']/gi),
    ].map((match) => new URL(match[1].replaceAll('&amp;', '&'), fichaUrl));
    const candidates = [
      ...new Set(
        links
          .filter(
            (url) =>
              url.hostname === SOURCE_HOST &&
              url.pathname.includes(`/resource/${resourceId}/download/`) &&
              !url.search &&
              !url.hash,
          )
          .map((url) => url.href),
      ),
    ];
    if (candidates.length !== 1)
      throw new Error('No se encontró un único CSV en la ficha ANAC');
    const uri = candidates[0];
    return {
      fuente: await openCsvSource(connection(uri), 600, [SOURCE_HOST]),
      uri,
    };
  }

  private guardarMovimientos(revisionId: string, filas: MovimientoAnac[]) {
    return this.prisma.models.MovimientoAeropuerto.createAndCount(
      filas.map(({ fechaUtc, ...fila }) => ({
        ...fila,
        revisionId,
        fechaUtc: fechaUtc.slice(0, -1).replace('T', ' '),
      })),
    );
  }

  private prepararRevision(periodo: string, ejecucionId: string, uri: string) {
    return this.prisma.db.transaction(async (tx) => {
      const job = await tx.orm.public.EjecucionEtl.where({ id: ejecucionId })
        .select('intento')
        .forUpdate()
        .firstOrThrow();
      const revision = await tx.orm.public.RevisionActividad.where({
        id: ejecucionId,
      })
        .select('estado')
        .forUpdate()
        .first();
      if (revision?.estado === 'publicada') return null;

      await tx.orm.public.RevisionActividad.upsert({
        create: { id: ejecucionId, periodo: periodo + '-01', uri },
        update: {
          estado: 'procesando',
          filasProcesadas: 0,
          filasDescartadas: 0,
          checksum: null,
          uri,
        },
      });
      await tx.orm.public.MovimientoAeropuerto.where({
        revisionId: ejecucionId,
      }).deleteAndCount();
      return job;
    });
  }

  async importar(
    fuente: Readable,
    periodo: string,
    ejecucionId: string,
    uri: string,
  ) {
    if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo))
      throw new BadRequestException('Mes ANAC inválido');
    const db = this.prisma.db;
    const job = await this.prepararRevision(periodo, ejecucionId, uri);
    if (!job) {
      fuente.destroy();
      return;
    }
    const hash = createHash('sha256');
    let bytes = 0,
      numeroFila = 0,
      processed = 0,
      discarded = 0,
      headersValid = false;
    const diasObservados = new Set<string>();
    let batch: MovimientoAnac[] = [];
    const flush = async () => {
      if (!batch.length) return;
      await this.guardarMovimientos(ejecucionId, batch);
      processed += batch.length;
      batch = [];
    };
    try {
      const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > 1024 * 1024 * 1024) {
            callback(new Error('ANAC excede el límite de descarga de 1 GiB'));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      const parser = csv({
        separator: ';',
        strict: true,
        maxRowBytes: 65536,
        mapHeaders: ({ header }) => {
          const nombre = cabeceraAnac(header);
          return ANAC_HEADERS.includes(nombre) ? nombre : null;
        },
      });
      parser.on('headers', (headers: (string | null)[]) => {
        headersValid = ANAC_HEADERS.every((header) => headers.includes(header));
        if (!headersValid)
          parser.destroy(new Error('Cabecera ANAC incompatible'));
      });
      await pipeline(fuente, limit, parser, async (rows) => {
        for await (const input of rows) {
          numeroFila++;
          const row = input as Record<string, string>;
          const date = fechaUtcAnac(row['Fecha UTC'] ?? '');
          if (date && date.slice(0, 7) !== periodo) continue;
          try {
            if (!date) throw new Error('Fecha UTC inválida');
            batch.push(normalizarMovimiento(row, numeroFila, date));
            diasObservados.add(date);
          } catch (error) {
            discarded++;
            if (discarded <= 100)
              await this.prisma.models.MuestraDescartadaEtl.create({
                ejecucionId,
                intento: job.intento,
                numeroFila,
                motivo:
                  error instanceof Error
                    ? error.message
                    : 'Movimiento inválido',
                muestraOriginal: JSON.stringify(row).slice(0, 4096),
              });
          }
          if (batch.length === 2000) await flush();
        }
      });
      await flush();
      if (!headersValid || !processed || discarded)
        throw new Error(
          discarded
            ? 'ANAC contiene filas rechazadas: se conserva la publicación anterior'
            : 'El CSV ANAC no contiene movimientos para el mes seleccionado',
        );
      const [year, month] = periodo.split('-').map(Number);
      const diasMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
      // shortcut: coverage requires a record each day; verify counts against a manifest if ANAC publishes one.
      if (diasObservados.size !== diasMes)
        throw new Error('El CSV ANAC no abarca todo el mes seleccionado');
      const checksum = hash.digest('hex');
      await db.transaction(async (tx) => {
        await tx.orm.public.EjecucionEtl.where({ id: ejecucionId })
          .select('id')
          .forUpdate()
          .firstOrThrow();
        await bloquearMesAnac(tx, periodo);
        await tx.orm.public.RevisionActividad.where({ id: ejecucionId }).update(
          {
            estado: 'publicada',
            checksum,
            filasProcesadas: processed,
            filasDescartadas: 0,
            actualizadoEn: new Date()
              .toISOString()
              .slice(0, -1)
              .replace('T', ' '),
          },
        );
        await tx.orm.public.PublicacionActividad.upsert({
          create: { periodo: periodo + '-01', revisionId: ejecucionId },
          update: { revisionId: ejecucionId },
        });
        await tx.orm.public.EjecucionEtl.where({ id: ejecucionId }).update({
          estado: 'completed',
          finalizadoEn: new Date()
            .toISOString()
            .replace('T', ' ')
            .replace('Z', ''),
          filasTotales: processed,
          filasProcesadas: processed,
          filasInsertadas: processed,
          filasDescartadas: 0,
          checksumFuente: checksum,
          uriFuente: uri,
        });
        await tx.orm.public.EventoEjecucionEtl.create({
          ejecucionId,
          intento: job.intento,
          nivel: 'success',
          mensaje: 'Mes ANAC publicado; las revisiones anteriores se conservan',
        });
      });
      return { processed, discarded, checksum };
    } catch (error) {
      await this.prisma.models.RevisionActividad.where({
        id: ejecucionId,
      }).update({
        estado: 'rechazada',
        filasProcesadas: processed,
        filasDescartadas: discarded,
        actualizadoEn: new Date().toISOString().slice(0, -1).replace('T', ' '),
      });
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        filasTotales: processed + discarded,
        filasProcesadas: processed,
        filasInsertadas: processed,
        filasDescartadas: discarded,
      });
      throw error;
    } finally {
      fuente.destroy();
    }
  }

  async consultar(dto: ConsultaActividadDto, conectividad = false) {
    const { db, models } = this.prisma;
    const periodo = dto.periodo + '-01';
    const publicacion = await models.PublicacionActividad.where({ periodo })
      .include('revision')
      .first();
    const respuesta = {
      datos: [],
      total: 0,
      pagina: dto.pagina,
      limite: dto.limite,
      resumen: [],
      cobertura: null,
      fuente: 'ANAC — CC BY 4.0',
      metodologia:
        'Movimientos observados en UTC. La conectividad cuenta únicamente despegues.',
    };
    if (!publicacion) return respuesta;

    const revision = publicacion.revision;
    const offset = (dto.pagina - 1) * dto.limite;
    const tablas = db.sql.public;
    const filtrados = tablas.movimientos_aeropuerto
      .select()
      .where((m, sql) =>
        sql.and(
          sql.eq(m.revision_id, revision.id),
          ...(dto.aeropuerto ? [sql.eq(m.aeropuerto, dto.aeropuerto)] : []),
          ...(dto.operador ? [sql.eq(m.operador, dto.operador)] : []),
          ...(dto.clasificacion
            ? [sql.eq(m.clasificacion, dto.clasificacion)]
            : []),
          ...(dto.calidad ? [sql.eq(m.calidad, dto.calidad)] : []),
          ...(dto.movimiento ? [sql.eq(m.movimiento, dto.movimiento)] : []),
          ...(conectividad ? [sql.eq(m.movimiento, 'DESPEGUE')] : []),
        ),
      );
    const porClasificacion = filtrados
      .select('clasificacion', 'movimiento')
      .select('movimientos', (_m, sql) => sql.count())
      .groupBy('clasificacion', 'movimiento')
      .orderBy('clasificacion');
    const conexiones = filtrados
      .select('origen', 'destino', 'operador', 'clasificacion')
      .select('movimientosSalida', (_m, sql) => sql.count())
      .groupBy('origen', 'destino', 'operador', 'clasificacion');

    const [datos, grupos, totalConexiones] = await Promise.all([
      conectividad
        ? db.query(
            conexiones
              .orderBy('origen')
              .orderBy('destino')
              .orderBy('operador')
              .orderBy('clasificacion')
              .limit(dto.limite)
              .offset(offset)
              .build(),
          )
        : db.query(
            filtrados
              .select(
                'movimiento',
                'aeropuerto',
                'origen',
                'destino',
                'operador',
                'clase',
                'clasificacion',
                'calidad',
              )
              .select((m) => ({
                numeroFila: m.numero_fila,
                fechaUtc: m.fecha_utc,
              }))
              .orderBy('fecha_utc')
              .orderBy('numero_fila')
              .limit(dto.limite)
              .offset(offset)
              .build(),
          ),
      db.query(porClasificacion.build()),
      conectividad
        ? db.query(
            tablas.actividad_publicaciones
              .lateralJoin('totalConexiones', (lateral) =>
                lateral
                  .from(conexiones.as('conexiones'))
                  .select('total', (_m, sql) => sql.count()),
              )
              .select('total')
              .where((p, sql) => sql.eq(p.periodo, periodo))
              .build(),
          )
        : [],
    ]);
    const resumen = new Map<
      string,
      {
        clasificacion: string;
        movimientos: number;
        despegues: number;
        aterrizajes: number;
      }
    >();
    let movimientos = 0;
    for (const grupo of grupos) {
      const fila = resumen.get(grupo.clasificacion) ?? {
        clasificacion: grupo.clasificacion,
        movimientos: 0,
        despegues: 0,
        aterrizajes: 0,
      };
      movimientos += grupo.movimientos;
      fila.movimientos += grupo.movimientos;
      if (grupo.movimiento === 'DESPEGUE') fila.despegues += grupo.movimientos;
      else fila.aterrizajes += grupo.movimientos;
      resumen.set(grupo.clasificacion, fila);
    }
    return {
      ...respuesta,
      datos,
      total: conectividad ? (totalConexiones[0]?.total ?? 0) : movimientos,
      resumen: [...resumen.values()],
      cobertura: {
        revisionId: revision.id,
        periodo: revision.periodo,
        uri: revision.uri,
        checksum: revision.checksum,
        estado: revision.estado,
        filasProcesadas: revision.filasProcesadas,
        filasDescartadas: revision.filasDescartadas,
        actualizadoEn: timestampToJson(revision.actualizadoEn),
      },
    };
  }

  ejecuciones() {
    return this.prisma.models.EjecucionEtl.where({ fuente: 'ANAC' })
      .orderBy((job) => job.iniciadoEn.desc())
      .limit(20)
      .all();
  }

  async muestras(id: string, intento?: number) {
    const job = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente: 'ANAC',
    });
    if (!job) throw new NotFoundException('Ejecución ANAC inexistente');
    return this.prisma.models.MuestraDescartadaEtl.where({
      ejecucionId: id,
      intento: intento ?? job.intento,
    })
      .select('numeroFila', 'motivo')
      .orderBy((row) => row.numeroFila.asc())
      .limit(100)
      .all();
  }

  async revisiones(periodo: string) {
    const mes = periodo + '-01';
    const [revisiones, publicacion] = await Promise.all([
      this.prisma.models.RevisionActividad.where({ periodo: mes })
        .orderBy((revision) => revision.actualizadoEn.desc())
        .limit(20)
        .all(),
      this.prisma.models.PublicacionActividad.select('revisionId').first({
        periodo: mes,
      }),
    ]);
    return revisiones.map(({ actualizadoEn, ...revision }) => ({
      ...revision,
      actualizadoEn: timestampToJson(actualizadoEn),
      vigente: publicacion ? publicacion.revisionId === revision.id : null,
    }));
  }

  async correspondencias(dto: ConsultaActividadDto) {
    const { db } = this.prisma;
    const tablas = db.sql.public;
    return db.query(
      tablas.actividad_publicaciones
        .as('publicacion')
        .lateralJoin('codigos', (lateral) =>
          lateral
            .from(tablas.movimientos_aeropuerto.as('filaAnac'))
            .select(
              'codigo',
              ({ filaAnac }) =>
                new ExpressionImpl(
                  FunctionCallExpr.of('jsonb_array_elements_text', [
                    FunctionCallExpr.of('jsonb_build_array', [
                      filaAnac.origen.buildAst(),
                      filaAnac.destino.buildAst(),
                    ]),
                  ]),
                  filaAnac.origen.returnType,
                ),
            )
            .where((f, sql) =>
              sql.eq(f.filaAnac.revision_id, f.publicacion.revision_id),
            )
            .distinct()
            .orderBy('codigo')
            .limit(dto.limite)
            .offset((dto.pagina - 1) * dto.limite),
        )
        .outerLeftJoin(
          tablas.identidades_aeropuerto_fuente.as('identidad'),
          (f, sql) =>
            sql.and(
              sql.eq(f.identidad.fuente, 'ANAC'),
              sql.eq(f.identidad.identificador, f.codigos.codigo),
            ),
        )
        .outerLeftJoin(tablas.aeropuertos.as('aeropuerto'), (f, sql) =>
          sql.eq(f.aeropuerto.id, f.identidad.aeropuerto_id),
        )
        .select((f) => ({
          codigo: f.codigos.codigo,
          aeropuertoId: f.identidad.aeropuerto_id,
          nombre: f.aeropuerto.nombre,
        }))
        .where((f, sql) => sql.eq(f.publicacion.periodo, dto.periodo + '-01'))
        .orderBy('codigo')
        .build(),
    );
  }

  async resolver(dto: CorrespondenciaAnacDto) {
    const airport = await this.prisma.models.Aeropuerto.first({
      id: dto.aeropuertoId,
      archivadoEn: null,
    });
    if (!airport)
      throw new BadRequestException('Aeropuerto inexistente o archivado');
    await this.prisma.models.IdentidadAeropuertoFuente.upsert({
      create: {
        fuente: 'ANAC',
        identificador: dto.codigo,
        aeropuertoId: dto.aeropuertoId,
        observacion: {},
      },
      update: { aeropuertoId: dto.aeropuertoId },
    });
    return dto;
  }
}
