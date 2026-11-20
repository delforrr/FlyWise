import { LOTE_METRICAS_PENDIENTES } from './application/recalcular-pendientes.js';
import { FunctionCallExpr } from '@prisma/orm-postgres/relational-core/ast';
import { ExpressionImpl } from '@prisma/orm-postgres/relational-core/expression';
import { and } from '@prisma/orm-postgres/orm-client';
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

  async recalcularPendientes() {
    let total = 0;
    for (;;) {
      const lote = await this.prisma.db.transaction(
        recalcularMetricasPendientes,
      );
      total += lote;
      if (lote < LOTE_METRICAS_PENDIENTES) return total;
    }
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
    const mes = await this.prisma.models.MetricaRuta.where((m) =>
      m.periodo.gte(periodos.at(-1) + '-01'),
    )
      .where((m) => m.periodo.lte(periodos[0] + '-01'))
      .where((m) => m.actualizadoEn.isNotNull())
      .where((m) => m.vuelosTotales.gt(0))
      .select('periodo')
      .orderBy((m) => m.periodo.desc())
      .first();
    return mes?.periodo.slice(0, 7) ?? null;
  }

  async opcionesMapa() {
    const periodos = periodosCerradosMapa();
    const [periodoInicial, aerolineas] = await Promise.all([
      this.periodoInicialMapa(periodos),
      this.listarAerolineasDelMapa(periodos),
    ]);
    return { periodoInicial, periodos, aerolineas };
  }

  private listarAerolineasDelMapa(periodos: string[]) {
    return this.prisma.models.Aerolinea.where((a) =>
      a.metricas.some((m) =>
        and(
          m.periodo.gte(periodos.at(-1) + '-01'),
          m.periodo.lte(periodos[0] + '-01'),
          m.actualizadoEn.isNotNull(),
          m.vuelosTotales.gt(0),
        ),
      ),
    )
      .select('id', 'nombre', 'iata')
      .orderBy([(a) => a.nombre.asc(), (a) => a.id.asc()])
      .all();
  }

  contextoRuta(consulta: ContextoRutaDto) {
    if (!periodosCerradosMapa().includes(consulta.periodo)) {
      throw new BadRequestException(
        'El período debe estar entre los últimos doce meses cerrados',
      );
    }
    return consultarContextoRuta(this.prisma.db, consulta);
  }

  async consultar(
    consulta: ConsultaMetricasDto,
    pares?: ParRutaDto[],
    administrativo = false,
  ) {
    const { periodo, origenId, destinoId, aerolineaId, pagina, limite } =
      consulta;
    const { db } = this.prisma;
    const fecha = periodo + '-01';
    if (pares?.length === 0) return { datos: [], total: 0, pagina, limite };
    const tabla = db.sql.public.metricas_ruta;
    const base = tabla
      .select()
      .where((m, sql) =>
        sql.and(
          sql.eq(m.periodo, fecha),
          ...(origenId ? [sql.eq(m.origen_id, origenId)] : []),
          ...(destinoId ? [sql.eq(m.destino_id, destinoId)] : []),
          ...(aerolineaId ? [sql.eq(m.aerolinea_id, aerolineaId)] : []),
        ),
      );
    const filtradas = pares
      ? base.where((m, sql) =>
          sql.and(
            sql.ne(m.actualizado_en, null),
            sql.gt(m.vuelos_totales, 0),
            sql.or(
              ...pares.map((par) =>
                sql.and(
                  sql.eq(m.origen_id, par.origenId),
                  sql.eq(m.destino_id, par.destinoId),
                ),
              ),
            ),
          ),
        )
      : base;
    const agrupar = (query: typeof base) =>
      query.select((m) => ({ origenId: m.origen_id, destinoId: m.destino_id }));
    const consultaDatos = agrupar(filtradas)
      .select((m, sql) => ({
        vuelosTotales: sql.sum(m.vuelos_totales),
        vuelosCancelados: sql.sum(m.vuelos_cancelados),
        vuelosDesviados: sql.sum(m.vuelos_desviados),
        vuelosPuntuales: sql.sum(m.vuelos_puntuales),
        vuelosSinEvidencia: sql.sum(m.vuelos_sin_evidencia),
        demoraLlegadaTotalMinutos: sql.sum(m.demora_llegada_total_minutos),
        actualizadoEn: sql.min(m.actualizado_en),
        ...(administrativo && {
          errorActualizacion: sql.max(m.error_actualizacion),
          pendiente: new ExpressionImpl(
            FunctionCallExpr.of('bool_or', [m.pendiente.buildAst()]),
            m.pendiente.returnType,
          ),
        }),
        fuentes: new ExpressionImpl(
          FunctionCallExpr.of('jsonb_agg', [m.fuentes.buildAst()]),
          m.fuentes.returnType,
        ),
      }))
      .groupBy('origenId', 'destinoId')
      .orderBy('origenId')
      .orderBy('destinoId')
      .limit(limite)
      .offset((pagina - 1) * limite);
    const contarPares = (query: typeof base) =>
      db.query(
        tabla
          .as('metrica')
          .lateralJoin('resumen', (lateral) =>
            lateral
              .from(agrupar(query).groupBy('origenId', 'destinoId').as('pares'))
              .select('total', (_m, sql) => sql.count()),
          )
          .select('total')
          .where((m, sql) => sql.eq(m.metrica.periodo, fecha))
          .limit(1)
          .build(),
      );

    const [rows, conteo] = await Promise.all([
      db.query(consultaDatos.build()),
      contarPares(filtradas),
    ]);
    const datos = rows.map((row) => ({
      origenId: row.origenId,
      destinoId: row.destinoId,
      vuelosTotales: row.vuelosTotales ?? 0,
      vuelosCancelados: row.vuelosCancelados ?? 0,
      vuelosDesviados: row.vuelosDesviados ?? 0,
      vuelosPuntuales: row.vuelosPuntuales ?? 0,
      demoraLlegadaTotalMinutos: Number(row.demoraLlegadaTotalMinutos),
      ...(administrativo && {
        pendiente: row.pendiente,
        errorActualizacion: row.errorActualizacion,
      }),
      actualizadoEn: row.actualizadoEn,
      periodo,
      aerolineaId: aerolineaId ?? null,
      vuelosOperados: (row.vuelosTotales ?? 0) - (row.vuelosCancelados ?? 0),
      vuelosSinEvidencia: row.vuelosSinEvidencia ?? 0,
      otp15: porcentajeOtp(
        row.vuelosPuntuales ?? 0,
        (row.vuelosTotales ?? 0) -
          (row.vuelosCancelados ?? 0) -
          (row.vuelosSinEvidencia ?? 0),
      ),
      fuentes: [...new Set((row.fuentes as string[][]).flat())].sort(),
    }));
    const total =
      pares && !rows.length && pagina > 1
        ? ((await contarPares(base))[0]?.total ?? 0)
        : (conteo[0]?.total ?? 0);
    return { datos, total, pagina, limite };
  }
}
