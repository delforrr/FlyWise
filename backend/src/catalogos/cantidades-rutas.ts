import assert from 'node:assert/strict';
import { and, or } from '@prisma/orm-postgres/orm-client';
import {
  CaseExpr,
  LiteralExpr,
  RawQueryAst,
  CastExpr,
} from '@prisma/orm-postgres/relational-core/ast';
import {
  ExpressionImpl,
  type RawRowQuery,
} from '@prisma/orm-postgres/relational-core/expression';
import type { Database, Transaction } from '../prisma/db.js';

export function cantidadesRutas({ orm }: Database | Transaction) {
  const rutasVisibles = orm.public.Ruta.fragment((rutas) =>
    rutas.where((r) =>
      and(
        r.archivadoEn.isNull(),
        r.origen.some({ archivadoEn: null }),
        r.destino.some({ archivadoEn: null }),
        r.ofertas.some((f) =>
          and(
            f.archivadoEn.isNull(),
            or(f.aerolineaId.isNull(), f.aerolinea.some({ archivadoEn: null })),
          ),
        ),
      ),
    ),
  );
  return orm.public.Aeropuerto.fragment((aeropuertos) =>
    aeropuertos
      .include('rutasOrigen', (rutas) => rutas.with(rutasVisibles).count())
      .include('rutasDestino', (rutas) => rutas.with(rutasVisibles).count()),
  );
}

export function sumarCantidadesRutas<
  T extends { rutasOrigen: number; rutasDestino: number },
>({ rutasOrigen, rutasDestino, ...aeropuerto }: T) {
  return { ...aeropuerto, cantidadRutas: rutasOrigen + rutasDestino };
}

export async function conCantidadesRutas<T extends { id: string }>(
  db: Database | Transaction,
  rows: T[],
) {
  if (!rows.length) return [];
  const cantidades = await db.orm.public.Aeropuerto.where((a) =>
    a.id.in(rows.map(({ id }) => id)),
  )
    .with(cantidadesRutas(db))
    .select('id')
    .all();
  const porId = new Map(
    cantidades.map(({ id, rutasOrigen, rutasDestino }) => [
      id,
      rutasOrigen + rutasDestino,
    ]),
  );
  return rows.map((row) => ({ ...row, cantidadRutas: porId.get(row.id) ?? 0 }));
}

// shortcut: Prisma RC only embeds raw row queries; remove this bridge when typed embedding is supported.
export function consultaCantidadesRutas(
  db: Database | Transaction,
): RawRowQuery<{
  aeropuerto_id: string;
  cantidad: number;
}> {
  const tablas = db.sql.public;
  const consulta = tablas.rutas
    .as('conexion')
    .innerJoin(tablas.aeropuertos.as('origen'), (f, sql) =>
      sql.eq(f.origen.id, f.conexion.origen_id),
    )
    .innerJoin(tablas.aeropuertos.as('destino'), (f, sql) =>
      sql.eq(f.destino.id, f.conexion.destino_id),
    )
    .innerJoin(tablas.aeropuertos.as('extremo'), (f, sql) =>
      sql.or(
        sql.eq(f.extremo.id, f.conexion.origen_id),
        sql.eq(f.extremo.id, f.conexion.destino_id),
      ),
    )
    .select('aeropuerto_id', (f) => f.extremo.id)
    .select(
      'cantidad',
      (f, sql) =>
        new ExpressionImpl(
          CastExpr.as(
            sql
              .sum(
                new ExpressionImpl(
                  CaseExpr.of(
                    [
                      {
                        condition: sql
                          .eq(f.conexion.origen_id, f.conexion.destino_id)
                          .buildAst(),
                        value: LiteralExpr.of(2),
                      },
                    ],
                    LiteralExpr.of(1),
                  ),
                  { codecId: 'pg/int4@1', nullable: false } as const,
                ),
              )
              .buildAst(),
            'int4',
          ),
          { codecId: 'pg/int4@1', nullable: false } as const,
        ),
    )
    .where((f, sql) =>
      sql.and(
        sql.eq(f.conexion.archivado_en, null),
        sql.eq(f.origen.archivado_en, null),
        sql.eq(f.destino.archivado_en, null),
        sql.exists(
          tablas.ofertas_ruta
            .as('oferta')
            .outerLeftJoin(tablas.aerolineas.as('operadora'), (oferta, sql) =>
              sql.eq(oferta.operadora.id, oferta.oferta.aerolinea_id),
            )
            .select('id', (oferta) => oferta.oferta.id)
            .where((oferta, sql) =>
              sql.and(
                sql.eq(oferta.oferta.ruta_id, f.conexion.id),
                sql.eq(oferta.oferta.archivado_en, null),
                sql.or(
                  sql.eq(oferta.oferta.aerolinea_id, null),
                  sql.eq(oferta.operadora.archivado_en, null),
                ),
              ),
            ),
        ),
      ),
    )
    .groupBy('aeropuerto_id');
  const returns = {
    aeropuerto_id: { codecId: 'pg/text@1', nullable: false },
    cantidad: { codecId: 'pg/int4@1', nullable: false },
  } as const;
  const plan = consulta.build();
  const rendered = db.toSql(plan);
  assert.equal(
    rendered.params.length,
    0,
    'El conteo embebido debe ser independiente de parámetros',
  );
  return {
    returns,
    buildAst: () => RawQueryAst.rows([rendered.sql], returns),
    build: () => plan,
  };
}
