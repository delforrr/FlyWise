import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Transaction } from '../prisma/db.js';
import type { Operacion } from '../vuelos/operacion.js';
import type { ConsultaMetricasDto } from './dto/consulta-metricas.dto.js';
import {
  MAX_PARES_MAPA,
  type ConsultaMapaDto,
  type ParRutaDto,
} from './dto/consulta-mapa.dto.js';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async marcarPendiente(tx: Transaction, operacion: Operacion) {
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
      return tx.execute(
        tx.raw.sql`
        WITH calculos AS (
          SELECT m.origen_id,m.destino_id,m.aerolinea_id,m.periodo,a.*
          FROM metricas_ruta m CROSS JOIN LATERAL (
            SELECT count(*)::int AS total,
              count(*) FILTER (WHERE estado='CANCELLED')::int AS cancelados,
              count(*) FILTER (WHERE estado='DIVERTED')::int AS desviados,
              count(*) FILTER (WHERE estado='ARRIVED' AND demora_llegada_minutos<=15)::int AS puntuales,
              coalesce(sum(demora_llegada_minutos),0)::bigint AS demora,
              coalesce(jsonb_agg(DISTINCT fuente),'[]'::jsonb) AS fuentes
            FROM vuelos WHERE archivado_en IS NULL AND origen_id=m.origen_id AND destino_id=m.destino_id
              AND aerolinea_id=m.aerolinea_id AND fecha_vuelo>=m.periodo
              AND fecha_vuelo<m.periodo + interval '1 month'
          ) a WHERE m.pendiente
        )
        UPDATE metricas_ruta m SET vuelos_totales=a.total,vuelos_cancelados=a.cancelados,
          vuelos_desviados=a.desviados,vuelos_puntuales=a.puntuales,demora_llegada_total_minutos=a.demora,
          fuentes=a.fuentes,actualizado_en=CURRENT_TIMESTAMP,pendiente=false,error_actualizacion=NULL
        FROM calculos a WHERE (m.origen_id,m.destino_id,m.aerolinea_id,m.periodo)=(a.origen_id,a.destino_id,a.aerolinea_id,a.periodo)
      `
          .affectedCount()
          .build(),
      );
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

  async consultarMapa({ pares, ...filtros }: ConsultaMapaDto) {
    const { datos } = await this.consultar(
      { ...filtros, pagina: 1, limite: MAX_PARES_MAPA },
      pares,
    );
    return datos;
  }

  async opcionesMapa() {
    const { db } = this.prisma;
    const [meses, aerolineas] = await Promise.all([
      db.query(
        db.raw.sql`
        WITH meses AS (
          SELECT to_char(periodo, 'YYYY-MM') AS periodo
          FROM metricas_ruta WHERE vuelos_totales > 0 OR pendiente
          UNION SELECT periodo FROM cobertura_bts
        )
        SELECT meses.periodo, b.periodo IS NOT NULL AS "completoBts"
        FROM meses LEFT JOIN cobertura_bts b USING (periodo)
        ORDER BY meses.periodo DESC
      `
          .returnsRow({ periodo: 'pg/text@1', completoBts: 'pg/bool@1' })
          .build(),
      ),
      db.query(
        db.raw.sql`
        SELECT a.id, a.nombre, a.iata FROM aerolineas a
        WHERE EXISTS (
          SELECT 1 FROM metricas_ruta m WHERE m.aerolinea_id=a.id
            AND (m.vuelos_totales > 0 OR m.pendiente)
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
    return {
      periodoInicial: meses.find((mes) => mes.completoBts)?.periodo ?? null,
      periodos: meses.map((mes) => mes.periodo),
      aerolineas,
    };
  }

  async consultar(consulta: ConsultaMetricasDto, pares?: ParRutaDto[]) {
    const { periodo, origenId, destinoId, aerolineaId, pagina, limite } =
      consulta;
    const lote = JSON.stringify(pares ?? []);
    const rows = await this.prisma.db.query(
      this.prisma.db.raw.sql`
      SELECT origen_id AS "origenId",destino_id AS "destinoId",
        sum(vuelos_totales)::int AS "vuelosTotales",sum(vuelos_cancelados)::int AS "vuelosCancelados",
        sum(vuelos_desviados)::int AS "vuelosDesviados",sum(vuelos_puntuales)::int AS "vuelosPuntuales",
        sum(demora_llegada_total_minutos)::float8 AS "demoraLlegadaTotalMinutos", bool_or(pendiente) AS pendiente,
        max(error_actualizacion) AS "errorActualizacion",min(actualizado_en)::text AS "actualizadoEn",
        jsonb_agg(fuentes) AS fuentes, count(*) OVER()::int AS total
      FROM metricas_ruta WHERE periodo=${periodo + '-01'}::date
        AND (${origenId ?? ''}::text = '' OR origen_id=${origenId ?? ''})
        AND (${destinoId ?? ''}::text = '' OR destino_id=${destinoId ?? ''})
        AND (${aerolineaId ?? ''}::text = '' OR aerolinea_id=${aerolineaId ?? ''})
        AND (NOT ${pares !== undefined} OR (origen_id, destino_id) IN (
          SELECT p."origenId", p."destinoId" FROM jsonb_to_recordset(${lote}::jsonb) p("origenId" text, "destinoId" text)
        ))
      GROUP BY origen_id,destino_id ORDER BY origen_id,destino_id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}
    `
        .returnsRow({
          origenId: 'pg/text@1',
          destinoId: 'pg/text@1',
          vuelosTotales: 'pg/int4@1',
          vuelosCancelados: 'pg/int4@1',
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
      otp15:
        row.vuelosTotales === row.vuelosCancelados
          ? null
          : (100 * row.vuelosPuntuales) /
            (row.vuelosTotales - row.vuelosCancelados),
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
