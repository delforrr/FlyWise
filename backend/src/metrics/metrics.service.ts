import { consultarContextoRuta } from './contexto-ruta.js';
import { porcentajeOtp } from './domain/otp.js';
import {
  recalcularMetricasPendientes,
  registrarErrorMetricas,
} from './metricas-pendientes.store.js';
import type { ContextoRutaDto } from './dto/contexto-ruta.dto.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { periodosCerradosMapa } from './periodos-mapa.js';
import type { ConsultaMetricasDto } from './dto/consulta-metricas.dto.js';
import {
  MAX_PARES_MAPA,
  type ConsultaMapaDto,
  type ParRutaDto,
} from './dto/consulta-mapa.dto.js';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  recalcularPendientes() {
    return this.prisma.db.transaction(recalcularMetricasPendientes);
  }

  registrarError(error: unknown) {
    return registrarErrorMetricas(this.prisma.db, error);
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
