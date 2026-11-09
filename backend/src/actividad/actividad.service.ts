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
} from './anac.js';
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
    const [row] = await this.prisma.db.query(
      this.prisma.db.raw
        .sql`SELECT ficha_url AS "fichaUrl",expresion_cron AS "expresionCron",pausado FROM actividad_anac_config WHERE id='ANAC'`
        .returnsRow({
          fichaUrl: 'pg/text@1',
          expresionCron: 'pg/text@1',
          pausado: 'pg/bool@1',
        })
        .build(),
    );
    return row;
  }

  async guardarConfiguracion(dto: ConfiguracionAnacDto) {
    this.validarFicha(dto.fichaUrl);
    await this.prisma.db.execute(
      this.prisma.db.raw
        .sql`UPDATE actividad_anac_config SET ficha_url=${dto.fichaUrl},expresion_cron=${dto.expresionCron},pausado=${dto.pausado} WHERE id='ANAC'`
        .affectedCount()
        .build(),
    );
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

  async importar(
    fuente: Readable,
    periodo: string,
    ejecucionId: string,
    uri: string,
  ) {
    if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo))
      throw new BadRequestException('Mes ANAC inválido');
    const db = this.prisma.db;
    // A retry may replace only unpublished staging rows.
    const [revision] = await db.query(
      db.raw
        .sql`INSERT INTO actividad_anac_revisiones(id,periodo,uri) VALUES (${ejecucionId},${`${periodo}-01`}::date,${uri}) ON CONFLICT(id) DO UPDATE SET estado='procesando',filas_procesadas=0,filas_descartadas=0,checksum=NULL,uri=EXCLUDED.uri WHERE actividad_anac_revisiones.estado<>'publicada' RETURNING id`
        .returnsRow({ id: 'pg/text@1' })
        .build(),
    );
    if (!revision) {
      fuente.destroy();
      return;
    }
    await db.execute(
      db.raw
        .sql`DELETE FROM actividad_anac_movimientos WHERE revision_id=${ejecucionId}`
        .affectedCount()
        .build(),
    );
    const job = await this.prisma.models.EjecucionEtl.firstOrThrow({
      id: ejecucionId,
    });
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
      await db.execute(
        db.raw
          .sql`INSERT INTO actividad_anac_movimientos(revision_id,numero_fila,fecha_utc,movimiento,aeropuerto,origen,destino,operador,clase,clasificacion,aeronave,matricula,pasajeros,pax,calidad)
        SELECT ${ejecucionId},x."numeroFila",x."fechaUtc"::timestamptz AT TIME ZONE 'UTC',x.movimiento,x.aeropuerto,x.origen,x.destino,x.operador,x.clase,x.clasificacion,x.aeronave,x.matricula,x.pasajeros,x.pax,x.calidad
        FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x("numeroFila" int,"fechaUtc" text,movimiento text,aeropuerto text,origen text,destino text,operador text,clase text,clasificacion text,aeronave text,matricula text,pasajeros int,pax int,calidad text)`
          .affectedCount()
          .build(),
      );
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
        mapHeaders: ({ header }) => cabeceraAnac(header),
      });
      parser.on('headers', (headers: string[]) => {
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
        await tx.execute(
          tx.raw
            .sql`SELECT pg_advisory_xact_lock(hashtext('ANAC'),hashtext(${periodo}))`
            .affectedCount()
            .build(),
        );
        await tx.execute(
          tx.raw
            .sql`UPDATE actividad_anac_revisiones SET estado='publicada',checksum=${checksum},filas_procesadas=${processed},filas_descartadas=0,actualizado_en=CURRENT_TIMESTAMP WHERE id=${ejecucionId}`
            .affectedCount()
            .build(),
        );
        await tx.execute(
          tx.raw
            .sql`INSERT INTO actividad_anac_publicaciones(periodo,revision_id) VALUES (${`${periodo}-01`}::date,${ejecucionId}) ON CONFLICT(periodo) DO UPDATE SET revision_id=EXCLUDED.revision_id`
            .affectedCount()
            .build(),
        );
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
      await db.execute(
        db.raw
          .sql`UPDATE actividad_anac_revisiones SET estado='rechazada',filas_procesadas=${processed},filas_descartadas=${discarded},actualizado_en=CURRENT_TIMESTAMP WHERE id=${ejecucionId}`
          .affectedCount()
          .build(),
      );
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
    const db = this.prisma.db;
    const [row] = await db.query(
      db.raw.sql`
      WITH vigente AS (SELECT r.* FROM actividad_anac_publicaciones p JOIN actividad_anac_revisiones r ON r.id=p.revision_id WHERE p.periodo=${`${dto.periodo}-01`}::date),
      filtrados AS (SELECT m.* FROM actividad_anac_movimientos m JOIN vigente v ON m.revision_id=v.id
        WHERE (${dto.aeropuerto ?? ''}='' OR m.aeropuerto=${dto.aeropuerto ?? ''}) AND (${dto.operador ?? ''}='' OR m.operador=${dto.operador ?? ''})
        AND (${dto.clasificacion ?? ''}='' OR m.clasificacion=${dto.clasificacion ?? ''}) AND (${dto.calidad ?? ''}='' OR m.calidad=${dto.calidad ?? ''})
        AND (${dto.movimiento ?? ''}='' OR m.movimiento=${dto.movimiento ?? ''}) AND (NOT ${conectividad} OR m.movimiento='DESPEGUE')),
      conexiones AS (SELECT origen,destino,operador,clasificacion,count(*)::int AS "movimientosSalida",sum(pasajeros)::int AS pasajeros,count(pasajeros)::int AS "movimientosConPasajeros" FROM filtrados GROUP BY origen,destino,operador,clasificacion),
      datos AS (SELECT numero_fila AS "numeroFila",fecha_utc::text AS "fechaUtc",movimiento,aeropuerto,origen,destino,operador,clase,clasificacion,aeronave,matricula,pasajeros,pax,calidad FROM filtrados ORDER BY fecha_utc,numero_fila LIMIT ${dto.limite} OFFSET ${(dto.pagina - 1) * dto.limite}),
      pagina_conexiones AS (SELECT * FROM conexiones ORDER BY origen,destino,operador,clasificacion LIMIT ${dto.limite} OFFSET ${(dto.pagina - 1) * dto.limite}),
      resumen AS (SELECT clasificacion,count(*)::int AS movimientos,count(*) FILTER(WHERE movimiento='DESPEGUE')::int AS despegues,count(*) FILTER(WHERE movimiento='ATERRIZAJE')::int AS aterrizajes,
        sum(pasajeros)::int AS pasajeros,sum(pax)::int AS pax,count(pasajeros)::int AS "movimientosConPasajeros",count(pax)::int AS "movimientosConPax" FROM filtrados GROUP BY clasificacion ORDER BY clasificacion)
      SELECT json_build_object('datos',CASE WHEN ${conectividad} THEN COALESCE((SELECT json_agg(x) FROM pagina_conexiones x),'[]') ELSE COALESCE((SELECT json_agg(x) FROM datos x),'[]') END,
        'total',CASE WHEN ${conectividad} THEN (SELECT count(*)::int FROM conexiones) ELSE (SELECT count(*)::int FROM filtrados) END,'pagina',${dto.pagina}::int,'limite',${dto.limite}::int,
        'resumen',COALESCE((SELECT json_agg(x) FROM resumen x),'[]'),'cobertura',(SELECT json_build_object('revisionId',id,'periodo',periodo,'uri',uri,'checksum',checksum,'estado',estado,'filasProcesadas',filas_procesadas,'filasDescartadas',filas_descartadas,'actualizadoEn',actualizado_en) FROM vigente),
        'fuente','ANAC — CC BY 4.0','metodologia','Movimientos UTC. Conectividad: sólo despegues. Pasajeros: movimiento/aeropuerto; PAX: tarjetas de embarque, agregado nacional cabotaje. No sumar ambas columnas ni inferir vuelos, OTP, cancelaciones u ocupación.')::text AS json
    `
        .returnsRow({ json: 'pg/text@1' })
        .build(),
    );
    return JSON.parse(row.json) as unknown;
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
      .orderBy((row) => row.numeroFila.asc())
      .limit(100)
      .all();
  }

  async revisiones(periodo: string) {
    const db = this.prisma.db;
    const [row] = await db.query(
      db.raw
        .sql`SELECT COALESCE(json_agg(x),'[]')::text AS json FROM (SELECT r.id,r.periodo,r.estado,r.checksum,r.uri,r.filas_procesadas AS "filasProcesadas",r.filas_descartadas AS "filasDescartadas",r.actualizado_en AS "actualizadoEn",(p.revision_id=r.id) AS vigente FROM actividad_anac_revisiones r LEFT JOIN actividad_anac_publicaciones p ON p.periodo=r.periodo WHERE r.periodo=${`${periodo}-01`}::date ORDER BY r.actualizado_en DESC LIMIT 20) x`
        .returnsRow({ json: 'pg/text@1' })
        .build(),
    );
    return JSON.parse(row.json) as unknown;
  }

  async correspondencias(dto: ConsultaActividadDto) {
    const db = this.prisma.db;
    const [row] = await db.query(
      db.raw
        .sql`WITH codigos AS (SELECT m.origen AS codigo FROM actividad_anac_movimientos m JOIN actividad_anac_publicaciones p ON p.revision_id=m.revision_id WHERE p.periodo=${`${dto.periodo}-01`}::date UNION SELECT m.destino FROM actividad_anac_movimientos m JOIN actividad_anac_publicaciones p ON p.revision_id=m.revision_id WHERE p.periodo=${`${dto.periodo}-01`}::date)
      SELECT COALESCE(json_agg(x),'[]')::text AS json FROM (SELECT c.codigo,i.aeropuerto_id AS "aeropuertoId",a.nombre FROM codigos c LEFT JOIN identidades_aeropuerto_fuente i ON i.fuente='ANAC' AND i.identificador=c.codigo LEFT JOIN aeropuertos a ON a.id=i.aeropuerto_id ORDER BY c.codigo LIMIT ${dto.limite} OFFSET ${(dto.pagina - 1) * dto.limite}) x`
        .returnsRow({ json: 'pg/text@1' })
        .build(),
    );
    return JSON.parse(row.json) as unknown;
  }

  async resolver(dto: CorrespondenciaAnacDto) {
    const airport = await this.prisma.models.Aeropuerto.first({
      id: dto.aeropuertoId,
      archivadoEn: null,
    });
    if (!airport)
      throw new BadRequestException('Aeropuerto inexistente o archivado');
    await this.prisma.db.execute(
      this.prisma.db.raw
        .sql`INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,aeropuerto_id,observacion) VALUES ('ANAC',${dto.codigo},${dto.aeropuertoId},'{}'::jsonb) ON CONFLICT(fuente,identificador) DO UPDATE SET aeropuerto_id=EXCLUDED.aeropuerto_id`
        .affectedCount()
        .build(),
    );
    return dto;
  }
}
