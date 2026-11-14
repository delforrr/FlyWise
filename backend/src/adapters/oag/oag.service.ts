import type { AdaptadorOperaciones } from '../../ingestion/application/adaptador-operaciones.js';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ConfiguracionOagDto } from './oag.controller.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import {
  escribirPublicacion,
  cambioFuenteSinAutorizar,
} from '../../metrics/publicacion.store.js';
import { periodosCerradosMapa } from '../../metrics/periodos-mapa.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Transaction } from '../../prisma/db.js';
import { guardarObservaciones } from '../../vuelos/observaciones.store.js';
import {
  validarOperacion,
  type ObservacionVuelo,
} from '../../entities/vuelos/domain/operacion.js';
import {
  CredencialOagRechazada,
  CuotaOagAgotada,
  FalloOag,
  OAG_CLAVE_ENTORNO,
  OAG_ENDPOINT,
  type Codigos,
  type ConsultaOag,
} from './flight-info.js';

import {
  ADAPTADOR_OAG,
  type LecturaOag,
  type OperacionOag,
} from './adaptador-oag.js';
import { ingerirOperaciones } from '../../ingestion/application/ingesta-operaciones.js';

export const OAG_QUEUE = 'oag-queue';
const PROCESO_ID = '00000000-0000-4000-8000-000000000020';
const fuente = 'OAG';
const configuracionInicial: ConfiguracionOagDto = {
  origenId: '',
  destinoId: '',
  periodo: '',
  coberturaMinimaPct: 90,
  pausado: true,
};
const ahora = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
const MAX_FILAS = 10_000;
const MAX_PAGINAS = 1000;
const LOTE = 1000;
type AlcanceOag = Omit<ConfiguracionOagDto, 'pausado'> &
  ConsultaOag & {
    autorizarCambioFuente?: string[];
  };
type VueloResuelto = Omit<OperacionOag, 'carrier'> & { aerolineaId: string };
type CheckpointOag = {
  cursores: string[];
  total: number;
  descartadas: number;
  candidatos: [string, VueloResuelto][];
};
type TrabajoOag = {
  ejecucionId: string;
  checkpoint?: CheckpointOag;
  reintentarDesde?: number;
};

@Injectable()
export class OagService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OAG_QUEUE) private readonly queue: Queue<TrabajoOag>,
    private readonly metrics: MetricsService,
    @Inject(ADAPTADOR_OAG)
    private readonly adaptador: AdaptadorOperaciones<LecturaOag, OperacionOag>,
  ) {}

  async onModuleInit() {
    await this.queue.setGlobalConcurrency(1);
    await this.prisma.models.ProcesoEtl.createAndCount(
      [
        {
          id: PROCESO_ID,
          nombre: 'OAG Flight Info v2',
          nombreConjunto: 'Operaciones de vuelos',
          entidadDestino: 'otp_metrics',
          esSistema: true,
          pausado: true,
          conexion: {
            ...configuracionInicial,
            claveEntorno: OAG_CLAVE_ENTORNO,
          },
          mapeoEsquema: [],
          configuracionProgramacion: {},
        },
      ],
      { onConflict: 'skip' },
    );
    let cursor = '';
    for (;;) {
      const pendientes = await this.prisma.models.EjecucionEtl.where({ fuente })
        .where((row) => row.estado.in(['pending', 'running']))
        .where((row) => row.id.gt(cursor))
        .orderBy((row) => row.id.asc())
        .limit(100)
        .all();
      for (const pendiente of pendientes) {
        const job = await this.queue.getJob(pendiente.id);
        const estado = await job?.getState();
        if (!job || estado === 'failed' || estado === 'completed')
          await this.fallar(
            pendiente.id,
            pendiente.intento,
            'OAG se interrumpió. Podés reintentar la ejecución.',
            pendiente.filasTotales,
            pendiente.filasDescartadas,
          );
      }
      if (pendientes.length < 100) break;
      cursor = pendientes[pendientes.length - 1].id;
    }
  }

  async configuracion(): Promise<ConfiguracionOagDto> {
    const proceso = await this.prisma.models.ProcesoEtl.first({
      id: PROCESO_ID,
    });
    if (!proceso) return configuracionInicial;
    const conexion = proceso.conexion as Pick<
      ConfiguracionOagDto,
      'origenId' | 'destinoId' | 'periodo' | 'coberturaMinimaPct'
    >;
    return {
      pausado: proceso.pausado,
      origenId: conexion.origenId,
      destinoId: conexion.destinoId,
      periodo: conexion.periodo,
      coberturaMinimaPct: conexion.coberturaMinimaPct,
    };
  }

  async configurar({ pausado, ...alcance }: ConfiguracionOagDto) {
    await this.resolverAlcance(alcance);
    await this.prisma.models.ProcesoEtl.where({ id: PROCESO_ID }).update({
      pausado,
      conexion: { ...alcance, claveEntorno: OAG_CLAVE_ENTORNO },
    });
    return { pausado, ...alcance };
  }

  private async resolverAlcance(
    config: Omit<ConfiguracionOagDto, 'pausado'>,
  ): Promise<AlcanceOag> {
    if (!periodosCerradosMapa().includes(config.periodo))
      throw new BadRequestException(
        'Seleccioná uno de los últimos 12 meses cerrados',
      );
    if (config.origenId === config.destinoId)
      throw new BadRequestException('Origen y destino deben ser distintos');
    const aeropuertos = this.prisma.models.Aeropuerto;
    const [origen, destino] = await Promise.all(
      [config.origenId, config.destinoId].map((id) =>
        aeropuertos.first({ id, archivadoEn: null }),
      ),
    );
    if (!origen || !destino)
      throw new BadRequestException('Aeropuerto no disponible');
    for (const campo of ['iata', 'icao'] as const) {
      const origenCodigo = origen[campo];
      const destinoCodigo = destino[campo];
      if (!origenCodigo || !destinoCodigo || origenCodigo === destinoCodigo)
        continue;
      const [origenes, destinos] = await Promise.all(
        [origenCodigo, destinoCodigo].map((codigo) =>
          aeropuertos
            .where({ [campo]: codigo, archivadoEn: null })
            .limit(2)
            .all(),
        ),
      );
      if (origenes.length === 1 && destinos.length === 1)
        return {
          ...config,
          origenCodigo,
          destinoCodigo,
          tipoCodigo: campo === 'iata' ? 'IATA' : 'ICAO',
        };
    }
    throw new BadRequestException(
      'El tramo no tiene códigos IATA o ICAO inequívocos',
    );
  }

  async ejecutar(
    solicitanteId?: string,
    alcanceAnterior?: AlcanceOag,
    checkpoint?: CheckpointOag,
    autorizarCambioFuente: string[] = [],
  ) {
    const { pausado, ...config } = await this.configuracion();
    if (pausado) throw new ConflictException('OAG pausado');
    if (!process.env[OAG_CLAVE_ENTORNO]?.trim())
      throw new ConflictException(
        'OAG no cuenta con una credencial configurada',
      );
    const { origenId, destinoId, periodo, coberturaMinimaPct } =
      alcanceAnterior ?? config;
    const alcance = await this.resolverAlcance({
      origenId,
      destinoId,
      periodo,
      coberturaMinimaPct,
    });
    if (
      checkpoint &&
      alcanceAnterior &&
      (alcance.origenCodigo !== alcanceAnterior.origenCodigo ||
        alcance.destinoCodigo !== alcanceAnterior.destinoCodigo ||
        alcance.tipoCodigo !== alcanceAnterior.tipoCodigo)
    )
      checkpoint = undefined;
    const ejecucion = await this.prisma.db.transaction(async (tx) => {
      const [proceso] = await tx.query(
        tx.raw
          .sql`SELECT pausado FROM procesos_etl WHERE id=${PROCESO_ID} FOR UPDATE`
          .returnsRow({ pausado: 'pg/bool@1' })
          .build(),
      );
      if (!proceso || proceso.pausado)
        throw new ConflictException('OAG pausado');
      const [activa] = await tx.query(
        tx.raw.sql`
          SELECT id FROM ejecuciones_etl WHERE proceso_id=${PROCESO_ID} AND estado IN ('pending','running')
          AND instantanea_configuracion->'conexion'->>'origenId'=${alcance.origenId}
          AND instantanea_configuracion->'conexion'->>'destinoId'=${alcance.destinoId}
          AND instantanea_configuracion->'conexion'->>'periodo'=${alcance.periodo}
          LIMIT 1
        `
          .returnsRow({ id: 'pg/text@1' })
          .build(),
      );
      if (activa)
        throw new ConflictException(
          'Ya hay una ejecución OAG activa para este tramo y mes',
        );
      return tx.orm.public.EjecucionEtl.create({
        fuente,
        estado: 'pending',
        solicitanteId: solicitanteId ?? null,
        procesoId: PROCESO_ID,
        uriFuente: OAG_ENDPOINT,
        instantaneaConfiguracion: {
          conexion: { ...alcance, autorizarCambioFuente },
          mapeoEsquema: [],
          configuracionProgramacion: {},
        },
      });
    });
    try {
      await this.queue.add(
        'mes',
        checkpoint
          ? { ejecucionId: ejecucion.id, checkpoint }
          : { ejecucionId: ejecucion.id },
        {
          jobId: ejecucion.id,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      );
    } catch {
      await this.fallar(ejecucion.id, 0, 'No fue posible encolar OAG', 0, 0);
      throw new BadRequestException('No fue posible encolar OAG');
    }
    return { ejecucionId: ejecucion.id };
  }

  async ejecuciones() {
    const rows = await this.prisma.models.EjecucionEtl.where({ fuente })
      .orderBy((row) => row.iniciadoEn.desc())
      .limit(20)
      .all();
    return rows.map((row) => ({
      ...row,
      ...alcanceDe(row.instantaneaConfiguracion),
    }));
  }

  async reintentar(id: string, solicitanteId?: string) {
    const ejecucion = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente,
    });
    if (!ejecucion) throw new NotFoundException('Ejecución OAG inexistente');
    if (!['failed', 'completed'].includes(ejecucion.estado))
      throw new ConflictException('La ejecución sigue activa');
    const alcance = alcanceDe(ejecucion.instantaneaConfiguracion);
    if (!alcance) throw new BadRequestException('Falta el alcance del tramo');
    const trabajo =
      ejecucion.estado === 'failed' ? await this.queue.getJob(id) : undefined;
    if ((trabajo?.data.reintentarDesde ?? 0) > Date.now())
      throw new ConflictException(
        'OAG todavía solicita esperar antes de reintentar',
      );
    if (!trabajo?.data.checkpoint || !ejecucion.iniciadoEn)
      return this.ejecutar(solicitanteId, alcance);
    const [publicacionPosterior] = await this.prisma.db.query(
      this.prisma.db.raw.sql`
        SELECT 1 AS existe FROM metricas_ruta
        WHERE origen_id=${alcance.origenId} AND destino_id=${alcance.destinoId}
          AND periodo=${alcance.periodo + '-01'}::date AND fuentes ? 'OAG'
          AND actualizado_en > ${ejecucion.iniciadoEn}::timestamp
        LIMIT 1
      `
        .returnsRow({ existe: 'pg/int4@1' })
        .build(),
    );
    return this.ejecutar(
      solicitanteId,
      alcance,
      publicacionPosterior ? undefined : trabajo?.data.checkpoint,
    );
  }

  async importar(id: string) {
    const anterior = await this.prisma.models.EjecucionEtl.first({
      id,
      fuente,
    });
    if (!anterior || ['completed', 'failed'].includes(anterior.estado)) return;
    const intento = anterior.intento + 1;
    const ejecucion = await this.prisma.models.EjecucionEtl.where({
      id,
      intento: anterior.intento,
      estado: anterior.estado,
    }).update({ estado: 'running', intento, iniciadoEn: ahora() });
    if (!ejecucion) return;

    let total = 0;
    let descartadas = 0;
    let paginas = 0;
    let trabajo: Awaited<ReturnType<typeof this.queue.getJob>>;
    try {
      trabajo = await this.queue.getJob(id);
      if ((await this.configuracion()).pausado)
        throw new FalloOag('OAG pausado');
      const clave = process.env[OAG_CLAVE_ENTORNO]?.trim();
      if (!clave)
        throw new FalloOag('OAG no cuenta con una credencial configurada');
      const alcance = alcanceDe(ejecucion.instantaneaConfiguracion);
      if (!alcance) throw new FalloOag('Falta el alcance del tramo');

      const checkpoint = trabajo?.data.checkpoint;
      const cursores = checkpoint?.cursores ?? [];
      total = checkpoint?.total ?? 0;
      descartadas = checkpoint?.descartadas ?? 0;
      paginas = cursores.length;
      const candidatos = new Map(checkpoint?.candidatos);
      // shortcut: checkpoint acotado al job retenido; T10 traslada la preparación a PostgreSQL.
      const aerolineas = new Map<string, Promise<string | null>>();
      await ingerirOperaciones(
        this.adaptador,
        { consulta: alcance, clave, cursores },
        {
          iniciarLote({ filas }) {
            paginas++;
            total += filas.length;
            if (total > MAX_FILAS || paginas > MAX_PAGINAS)
              throw new FalloOag('OAG excedió el límite de esta corrida');
          },
          procesarFila: async (fila) => {
            if (fila.tipo === 'fuera-de-poblacion') return;
            if (fila.tipo === 'descarte') {
              descartadas++;
              return;
            }
            const normalizada = fila.operacion;
            const { carrier, ...vuelo } = normalizada;
            const codigo = JSON.stringify([carrier.iata, carrier.icao]);
            let resolucion = aerolineas.get(codigo);
            if (!resolucion) {
              resolucion = this.resolverAerolinea(carrier);
              aerolineas.set(codigo, resolucion);
            }
            const aerolineaId = await resolucion;
            if (!aerolineaId) {
              descartadas++;
              return;
            }
            const claveOperacion = JSON.stringify([
              aerolineaId,
              normalizada.id,
            ]);
            const previa = candidatos.get(claveOperacion);
            if (
              !previa ||
              normalizada.revision > previa.revision ||
              (normalizada.revision === previa.revision &&
                normalizada.estado &&
                (!previa.estado ||
                  (previa.estado === 'ARRIVED' &&
                    previa.demoraLlegadaMinutos === null &&
                    normalizada.estado === 'ARRIVED' &&
                    normalizada.demoraLlegadaMinutos !== null)))
            )
              candidatos.set(claveOperacion, { ...vuelo, aerolineaId });
          },
          async terminarLote({ cursor }) {
            if (cursor && trabajo) {
              cursores.push(cursor);
              await trabajo.updateData({
                ejecucionId: id,
                checkpoint: {
                  cursores,
                  total,
                  descartadas,
                  candidatos: [...candidatos],
                },
              });
            }
          },
        },
      );

      const porOperadora = new Map<
        string,
        {
          total: number;
          resueltas: number;
          llegadas: number;
          desviadas: number;
          canceladas: number;
        }
      >();
      const observaciones: ObservacionVuelo[] = [];
      for (const vuelo of candidatos.values()) {
        const resumen = porOperadora.get(vuelo.aerolineaId) ?? {
          total: 0,
          resueltas: 0,
          llegadas: 0,
          desviadas: 0,
          canceladas: 0,
        };
        porOperadora.set(vuelo.aerolineaId, resumen);
        resumen.total++;
        if (!vuelo.estado) {
          descartadas++;
          continue;
        }
        resumen.resueltas++;
        if (vuelo.estado === 'ARRIVED' && vuelo.demoraLlegadaMinutos !== null)
          resumen.llegadas++;
        if (vuelo.estado === 'DIVERTED') resumen.desviadas++;
        if (vuelo.estado === 'CANCELLED') resumen.canceladas++;
        observaciones.push({
          fuente,
          idRegistroFuente: JSON.stringify([vuelo.aerolineaId, vuelo.id]),
          ...validarOperacion({
            origenId: alcance.origenId,
            destinoId: alcance.destinoId,
            aerolineaId: vuelo.aerolineaId,
            fechaVuelo: vuelo.fechaVuelo,
            horarios: vuelo.horarios,
            numeroVuelo: vuelo.numeroVuelo,
            estado: vuelo.estado,
            demoraLlegadaMinutos: vuelo.demoraLlegadaMinutos,
          }),
        });
      }
      const cobertura = alcance.coberturaMinimaPct / 100;
      const tieneCobertura = [...porOperadora.values()].every(
        (r) =>
          r.resueltas >= cobertura * r.total &&
          r.llegadas >= cobertura * (r.total - r.canceladas - r.desviadas),
      );
      if (
        !observaciones.length ||
        !tieneCobertura ||
        observaciones.length < cobertura * (observaciones.length + descartadas)
      )
        throw new FalloOag('Cobertura OAG insuficiente para publicar');
      descartadas = total - observaciones.length;
      await this.prisma.db.transaction(async (tx) => {
        await this.metrics.bloquearCambios(tx);
        const [activa] = await tx.query(
          tx.raw.sql`
          SELECT id FROM ejecuciones_etl WHERE id=${id} AND intento=${intento} AND estado='running' FOR UPDATE
        `
            .returnsRow({ id: 'pg/text@1' })
            .build(),
        );
        if (!activa) return;
        const totalesPorOperadora = Object.fromEntries(
          [...porOperadora].map(([id, resumen]) => [id, resumen.resueltas]),
        );
        await this.protegerPublicacion(
          tx,
          alcance,
          totalesPorOperadora,
          observaciones.map((vuelo) => vuelo.idRegistroFuente),
        );
        const operadoras = Object.keys(totalesPorOperadora).filter(
          (id) => totalesPorOperadora[id] > 0,
        );
        if (
          await cambioFuenteSinAutorizar(
            tx,
            alcance,
            fuente,
            operadoras,
            alcance.autorizarCambioFuente ?? [],
          )
        ) {
          throw new FalloOag(
            'El cambio de fuente requiere autorización por operadora',
          );
        }
        let insertadas = 0;
        for (let i = 0; i < observaciones.length; i += LOTE) {
          const lote = await guardarObservaciones(
            tx,
            observaciones.slice(i, i + LOTE),
            id,
          );
          insertadas += lote.insertadas;
        }
        // FIXME(T12): exigir aprobación y verificar permisos antes de publicar datos reales.
        await this.retirarObservacionesAnteriores(tx, alcance, id);
        for (const aerolineaId of operadoras) {
          await escribirPublicacion(
            tx,
            { ...alcance, aerolineaId },
            { fuente, ejecucionId: id },
          );
        }
        await tx.orm.public.EjecucionEtl.where({ id, intento }).update({
          estado: 'completed',
          finalizadoEn: ahora(),
          filasTotales: total,
          filasProcesadas: observaciones.length,
          filasDescartadas: descartadas,
          filasInsertadas: insertadas,
        });
        await tx.orm.public.EventoEjecucionEtl.create({
          ejecucionId: id,
          intento,
          nivel: 'success',
          mensaje: `OAG publicado: ${paginas} páginas, ${observaciones.length} operaciones y ${descartadas} descartes`,
        });
      });
    } catch (error) {
      const mensaje =
        error instanceof FalloOag
          ? error.message
          : 'No se pudo publicar la ejecución OAG';
      await this.fallar(
        id,
        intento,
        mensaje,
        total,
        descartadas,
        error instanceof CredencialOagRechazada,
      );
      if (error instanceof CuotaOagAgotada && trabajo)
        await trabajo.updateData({
          ...trabajo.data,
          reintentarDesde: error.reintentarDesde,
        });
      throw new Error(mensaje);
    }
  }

  private async resolverAerolinea({
    iata,
    icao,
  }: Codigos): Promise<string | null> {
    if (iata && !/^[A-Z0-9]{2}$/.test(iata)) return null;
    if (icao && !/^[A-Z0-9]{3}$/.test(icao)) return null;
    if (!iata && !icao) return null;
    const aerolineas = this.prisma.models.Aerolinea;
    const ids: string[] = [];
    for (const [campo, codigo] of [
      ['iata', iata],
      ['icao', icao],
    ] as const) {
      if (!codigo) continue;
      const rows = await aerolineas
        .where({ [campo]: codigo, archivadoEn: null })
        .limit(2)
        .all();
      if (rows.length > 1) return null;
      if (rows[0]) ids.push(rows[0].id);
      else if (iata && icao) return null;
    }
    return ids.length && ids.every((id) => id === ids[0]) ? ids[0] : null;
  }

  private async protegerPublicacion(
    tx: Transaction,
    { origenId, destinoId, periodo }: AlcanceOag,
    totalesPorOperadora: Record<string, number>,
    identidades: string[],
  ) {
    const [faltante] = await tx.query(
      tx.raw.sql`
      SELECT aerolinea_id AS id FROM metricas_ruta
      WHERE origen_id=${origenId} AND destino_id=${destinoId} AND periodo=${periodo + '-01'}::date
      AND fuentes ? 'OAG'
      AND coalesce((${JSON.stringify(totalesPorOperadora)}::jsonb ->> aerolinea_id)::int, 0) < vuelos_totales
      UNION ALL
      SELECT aerolinea_id AS id FROM vuelos
      WHERE origen_id=${origenId} AND destino_id=${destinoId}
        AND fecha_vuelo>=${periodo + '-01'}::date
        AND fecha_vuelo<${periodo + '-01'}::date+interval '1 month'
        AND fuente='OAG' AND archivado_en IS NULL AND NOT protegido_manualmente
        AND NOT (${JSON.stringify(identidades)}::jsonb ? id_registro_fuente)
      LIMIT 1
    `
        .returnsRow({ id: 'pg/text@1' })
        .build(),
    );
    if (faltante)
      throw new FalloOag(
        'Cobertura OAG insuficiente para una operadora ya publicada',
      );
  }

  private async retirarObservacionesAnteriores(
    tx: Transaction,
    { origenId, destinoId, periodo }: AlcanceOag,
    ejecucionId: string,
  ) {
    const mes = periodo + '-01';
    await tx.execute(
      tx.raw.sql`
      WITH retiradas AS (
        UPDATE vuelos SET archivado_en=CURRENT_TIMESTAMP,version=version+1,ejecucion_etl_id=${ejecucionId}
        WHERE fuente='OAG' AND origen_id=${origenId} AND destino_id=${destinoId}
        AND fecha_vuelo>=${mes}::date AND fecha_vuelo<${mes}::date+interval '1 month'
        AND NOT protegido_manualmente AND archivado_en IS NULL
        AND ejecucion_etl_id IS DISTINCT FROM ${ejecucionId}
        RETURNING *
      )
      INSERT INTO historial_vuelos(id,vuelo_id,version,accion,instantanea)
      SELECT gen_random_uuid()::text,id,version,'retiro-fuente',
        jsonb_build_object('id',id,'version',version,'fuente',fuente,'idRegistroFuente',id_registro_fuente,
          'fechaVuelo',fecha_vuelo,'numeroVuelo',numero_vuelo,'origenId',origen_id,'destinoId',destino_id,
          'aerolineaId',aerolinea_id,'estado',estado,'demoraLlegadaMinutos',demora_llegada_minutos,'horarios',horarios,
          'protegidoManualmente',false,'archivadoEn',archivado_en,'ejecucionEtlId',ejecucion_etl_id,'ultimaObservacion',ultima_observacion)
      FROM retiradas
    `
        .affectedCount()
        .build(),
    );
  }

  private async fallar(
    id: string,
    intento: number,
    mensaje: string,
    filasTotales: number,
    filasDescartadas: number,
    pausar = false,
  ) {
    await this.prisma.db.transaction(async (tx) => {
      if (pausar)
        await tx.orm.public.ProcesoEtl.where({ id: PROCESO_ID }).update({
          pausado: true,
        });
      const ejecucion = await tx.orm.public.EjecucionEtl.where({
        id,
        intento,
      })
        .where((row) => row.estado.in(['pending', 'running']))
        .update({
          estado: 'failed',
          finalizadoEn: intento ? ahora() : null,
          mensajeError: mensaje,
          filasTotales,
          filasDescartadas,
        });
      if (ejecucion)
        await tx.orm.public.EventoEjecucionEtl.create({
          ejecucionId: id,
          intento,
          nivel: 'error',
          mensaje,
        });
    });
  }
}

function alcanceDe(snapshot: unknown) {
  return (snapshot as { conexion?: AlcanceOag } | null)?.conexion;
}
