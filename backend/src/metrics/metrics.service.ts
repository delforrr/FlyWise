import { consultarContextoRuta } from './contexto-ruta.js';
import { porcentajeOtp } from './domain/otp.js';
import { escribirPublicacion } from './publicacion.store.js';
import type { ContextoRutaDto } from './dto/contexto-ruta.dto.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { periodosCerradosMapa } from './periodos-mapa.js';
import type { Transaction } from '../prisma/db.js';
import type { Operacion } from '../entities/vuelos/domain/operacion.js';
import type { ConsultaMetricasDto } from './dto/consulta-metricas.dto.js';
import {
  MAX_PARES_MAPA,
  type ConsultaMapaDto,
  type ParRutaDto,
} from './dto/consulta-mapa.dto.js';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async marcarPendiente(
    tx: Transaction,
    operacion: Pick<
      Operacion,
      'origenId' | 'destinoId' | 'aerolineaId' | 'fechaVuelo'
    >,
  ) {
    await tx.execute(
      tx.raw.sql`
      INSERT INTO metricas_ruta(origen_id,destino_id,aerolinea_id,periodo,vuelos_totales,vuelos_cancelados,vuelos_desviados,vuelos_puntuales,demora_llegada_total_minutos,actualizado_en,pendiente)
      VALUES (${operacion.origenId},${operacion.destinoId},${operacion.aerolineaId},${operacion.fechaVuelo.slice(0, 7) + '-01'}::date,0,0,0,0,0,NULL,true)
      ON CONFLICT (origen_id,destino_id,aerolinea_id,periodo) DO UPDATE SET pendiente=true,error_actualizacion=NULL
    `
        .affectedCount()
        .build(),
    );
  }

  async bloquearCambios(tx: Transaction) {
    // A publication sees every operation and its pending marker in the same generation.
    await tx.execute(
      tx.raw.sql`SELECT pg_advisory_xact_lock(826103)`.affectedCount().build(),
    );
  }

  async recalcularPendientes() {
    return this.prisma.db.transaction(async (tx) => {
      await this.bloquearCambios(tx);
      let recalculadas = 0;
      for (;;) {
        const pendientes = await tx.query(
          tx.raw.sql`
            SELECT m.origen_id AS "origenId",m.destino_id AS "destinoId",
              m.aerolinea_id AS "aerolineaId",to_char(m.periodo,'YYYY-MM') AS periodo,
              (m.ejecucion_etl_id IS NOT NULL OR
                (m.actualizado_en IS NOT NULL AND m.fuentes <> '["Administrativa"]'::jsonb
                  AND m.vuelos_totales > 0)) AS publicada
            FROM metricas_ruta m
            WHERE m.pendiente
            ORDER BY m.origen_id,m.destino_id,m.aerolinea_id,m.periodo LIMIT 100
          `
            .returnsRow({
              origenId: 'pg/text@1',
              destinoId: 'pg/text@1',
              aerolineaId: 'pg/text@1',
              periodo: 'pg/text@1',
              publicada: 'pg/bool@1',
            })
            .build(),
        );
        for (const { publicada, ...poblacion } of pendientes) {
          if (publicada) {
            // Una recomputación del circuito legado no sustituye una publicación vigente.
            await tx.orm.public.MetricaRuta.where({
              ...poblacion,
              periodo: poblacion.periodo + '-01',
            }).update({ pendiente: false, errorActualizacion: null });
          } else {
            await escribirPublicacion(tx, poblacion, {
              fuente: 'Administrativa',
              ejecucionId: null,
            });
          }
          recalculadas++;
        }
        if (pendientes.length < 100) return recalculadas;
      }
    });
  }
  async registrarError(error: unknown) {
    const mensaje =
      error instanceof Error
        ? error.message.slice(0, 500)
        : 'Falló la actualización de métricas';
    await this.prisma.db.execute(
      this.prisma.db.raw
        .sql`UPDATE metricas_ruta SET error_actualizacion=${mensaje} WHERE pendiente`
        .affectedCount()
        .build(),
    );
  }

  async consultarMapa({ pares, periodo, aerolineaId }: ConsultaMapaDto) {
    const periodos = periodosCerradosMapa();
    if (periodo && !periodos.includes(periodo)) {
      throw new BadRequestException(
        'El período debe estar entre los últimos doce meses cerrados',
      );
    }
    const seleccionado = periodo || (await this.periodoInicialMapa(periodos));
    if (!seleccionado) return [];

    const { datos } = await this.consultar(
      { periodo: seleccionado, aerolineaId, pagina: 1, limite: MAX_PARES_MAPA },
      pares,
    );
    return datos;
  }

  private async periodoInicialMapa(periodos: string[]) {
    const { db } = this.prisma;
    const [mes] = await db.query(
      db.raw.sql`
        SELECT to_char(max(periodo), 'YYYY-MM') AS periodo
        FROM metricas_ruta
        WHERE periodo BETWEEN ${periodos.at(-1) + '-01'}::date AND ${periodos[0] + '-01'}::date
          AND actualizado_en IS NOT NULL AND vuelos_totales > 0
      `
        .returnsRow({ periodo: { codecId: 'pg/text@1', nullable: true } })
        .build(),
    );
    return mes.periodo;
  }

  async opcionesMapa() {
    const { db } = this.prisma;
    const periodos = periodosCerradosMapa();
    const [periodoInicial, aerolineas] = await Promise.all([
      this.periodoInicialMapa(periodos),
      db.query(
        db.raw.sql`
        SELECT a.id, a.nombre, a.iata FROM aerolineas a
        WHERE EXISTS (
          SELECT 1 FROM metricas_ruta m WHERE m.aerolinea_id=a.id
            AND m.periodo BETWEEN ${periodos.at(-1) + '-01'}::date AND ${periodos[0] + '-01'}::date
            AND m.actualizado_en IS NOT NULL AND m.vuelos_totales > 0
        )
        ORDER BY a.nombre, a.id
      `
          .returnsRow({
            id: 'pg/text@1',
            nombre: 'pg/text@1',
            iata: { codecId: 'pg/text@1', nullable: true },
          })
          .build(),
      ),
    ]);
    return { periodoInicial, periodos, aerolineas };
  }

  contextoRuta(consulta: ContextoRutaDto) {
    if (!periodosCerradosMapa().includes(consulta.periodo)) {
      throw new BadRequestException(
        'El período debe estar entre los últimos doce meses cerrados',
      );
    }
    return consultarContextoRuta(this.prisma.db, consulta);
  }

  async consultar(consulta: ConsultaMetricasDto, pares?: ParRutaDto[]) {
    const { periodo, origenId, destinoId, aerolineaId, pagina, limite } =
      consulta;
    const lote = JSON.stringify(pares ?? []);
    const rows = await this.prisma.db.query(
      this.prisma.db.raw.sql`
      SELECT origen_id AS "origenId",destino_id AS "destinoId",
        sum(vuelos_totales)::int AS "vuelosTotales",sum(vuelos_cancelados)::int AS "vuelosCancelados",
        sum(vuelos_sin_evidencia)::int AS "vuelosSinEvidencia",
        sum(vuelos_desviados)::int AS "vuelosDesviados",sum(vuelos_puntuales)::int AS "vuelosPuntuales",
        sum(demora_llegada_total_minutos)::float8 AS "demoraLlegadaTotalMinutos", bool_or(pendiente) AS pendiente,
        max(error_actualizacion) AS "errorActualizacion",min(actualizado_en)::text AS "actualizadoEn",
        jsonb_agg(fuentes) AS fuentes, count(*) OVER()::int AS total
      FROM metricas_ruta WHERE periodo=${periodo + '-01'}::date
        AND (${origenId ?? ''}::text = '' OR origen_id=${origenId ?? ''})
        AND (${destinoId ?? ''}::text = '' OR destino_id=${destinoId ?? ''})
        AND (${aerolineaId ?? ''}::text = '' OR aerolinea_id=${aerolineaId ?? ''})
        AND (NOT ${pares !== undefined} OR (actualizado_en IS NOT NULL AND vuelos_totales > 0
          AND (origen_id, destino_id) IN (
          SELECT p."origenId", p."destinoId" FROM jsonb_to_recordset(${lote}::jsonb) p("origenId" text, "destinoId" text)
        )))
      GROUP BY origen_id,destino_id ORDER BY origen_id,destino_id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}
    `
        .returnsRow({
          origenId: 'pg/text@1',
          destinoId: 'pg/text@1',
          vuelosTotales: 'pg/int4@1',
          vuelosCancelados: 'pg/int4@1',
          vuelosSinEvidencia: 'pg/int4@1',
          vuelosDesviados: 'pg/int4@1',
          vuelosPuntuales: 'pg/int4@1',
          demoraLlegadaTotalMinutos: 'pg/float8@1',
          pendiente: 'pg/bool@1',
          errorActualizacion: { codecId: 'pg/text@1', nullable: true },
          actualizadoEn: { codecId: 'pg/text@1', nullable: true },
          fuentes: 'pg/jsonb@1',
          total: 'pg/int4@1',
        })
        .build(),
    );
    const datos = rows.map((row) => ({
      origenId: row.origenId,
      destinoId: row.destinoId,
      vuelosTotales: row.vuelosTotales,
      vuelosCancelados: row.vuelosCancelados,
      vuelosDesviados: row.vuelosDesviados,
      vuelosPuntuales: row.vuelosPuntuales,
      demoraLlegadaTotalMinutos: row.demoraLlegadaTotalMinutos,
      pendiente: row.pendiente,
      errorActualizacion: row.errorActualizacion,
      actualizadoEn: row.actualizadoEn,
      periodo,
      aerolineaId: aerolineaId ?? null,
      vuelosOperados: row.vuelosTotales - row.vuelosCancelados,
      vuelosSinEvidencia: row.vuelosSinEvidencia,
      otp15: porcentajeOtp(
        row.vuelosPuntuales,
        row.vuelosTotales - row.vuelosCancelados - row.vuelosSinEvidencia,
      ),
      fuentes: [...new Set((row.fuentes as string[][]).flat())].sort(),
    }));
    let total = rows[0]?.total ?? 0;
    if (!rows.length && pagina > 1) {
      const [resumen] = await this.prisma.db.query(
        this.prisma.db.raw.sql`
        SELECT count(DISTINCT (origen_id,destino_id))::int AS total
        FROM metricas_ruta WHERE periodo=${periodo + '-01'}::date
          AND (${origenId ?? ''}::text = '' OR origen_id=${origenId ?? ''})
          AND (${destinoId ?? ''}::text = '' OR destino_id=${destinoId ?? ''})
          AND (${aerolineaId ?? ''}::text = '' OR aerolinea_id=${aerolineaId ?? ''})
      `
          .returnsRow({ total: 'pg/int4@1' })
          .build(),
      );
      total = resumen.total;
    }
    return { datos, total, pagina, limite };
  }
}
