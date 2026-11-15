import { and, or } from '@prisma/orm-postgres/orm-client';
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
