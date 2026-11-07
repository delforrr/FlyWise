import { and, or, type CollectionRowOf } from '@prisma/orm-postgres/orm-client';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { GlobalRoutesDto } from './dto/global-routes.dto.js';
import { COUNTRY_CONTINENTS } from '../countries/continents.js';

export function includeRouteDetails(prisma: PrismaService) {
  return prisma.models.OfertaRuta.where((r) =>
    and(
      r.archivadoEn.isNull(),
      r.ruta.some((conexion) =>
        and(
          conexion.archivadoEn.isNull(),
          conexion.origen.some({ archivadoEn: null }),
          conexion.destino.some({ archivadoEn: null }),
        ),
      ),
      or(r.aerolineaId.isNull(), r.aerolinea.some({ archivadoEn: null })),
    ),
  )
    .include('ruta', (ruta) => ruta.include('origen').include('destino'))
    .include('aerolinea');
}

export type RouteWithRelations = CollectionRowOf<
  ReturnType<typeof includeRouteDetails>
>;

// The global query ranks pairs in PostgreSQL before loading their offers.
// Keep its visibility predicates aligned with includeRouteDetails; integration tests cover both.
export async function seleccionarConexiones(
  prisma: PrismaService,
  dto: GlobalRoutesDto,
) {
  const entries = Object.entries(COUNTRY_CONTINENTS);
  const originCodes = JSON.stringify(
    entries
      .filter(
        ([, continent]) =>
          dto.mode !== 'continents' || continent === dto.continenteOrigen,
      )
      .map(([iso]) => iso),
  );
  const destinationCodes = JSON.stringify(
    entries
      .filter(
        ([, continent]) =>
          dto.mode !== 'continents' || continent === dto.continenteDestino,
      )
      .map(([iso]) => iso),
  );
  const symmetric = dto.mode === 'global' || dto.mode === 'domestic';
  return await prisma.db.query(
    prisma.db.raw.sql`
      WITH candidates AS (
        SELECT DISTINCT
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.nombre), o.id) > (COALESCE(d.iata, d.icao, d.nombre), d.id) THEN d.id ELSE o.id END AS "origenId",
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.nombre), o.id) > (COALESCE(d.iata, d.icao, d.nombre), d.id) THEN o.id ELSE d.id END AS "destinoId",
          o.cantidad_rutas + d.cantidad_rutas AS score
        FROM ofertas_ruta r JOIN rutas conexion ON conexion.id=r.ruta_id
        JOIN aeropuertos o ON o.id = conexion.origen_id
        JOIN aeropuertos d ON d.id = conexion.destino_id
        LEFT JOIN paises oc ON oc.id = o.pais_id
        LEFT JOIN paises dc ON dc.id = d.pais_id
        WHERE r.archivado_en IS NULL AND conexion.archivado_en IS NULL AND o.archivado_en IS NULL AND d.archivado_en IS NULL AND (r.aerolinea_id IS NULL OR EXISTS (SELECT 1 FROM aerolineas a WHERE a.id=r.aerolinea_id AND a.archivado_en IS NULL)) AND r.escalas = 0 AND (
          ${dto.mode === 'global'} OR (
            UPPER(TRIM(oc.codigo_iso)) IN (SELECT jsonb_array_elements_text(${originCodes}::jsonb))
            AND UPPER(TRIM(dc.codigo_iso)) IN (SELECT jsonb_array_elements_text(${destinationCodes}::jsonb))
            AND (
              (${dto.mode === 'domestic'} AND oc.id = ${dto.paisOrigenId ?? ''}::text AND dc.id = oc.id)
              OR (${dto.mode === 'paises'} AND oc.id = ${dto.paisOrigenId ?? ''}::text AND dc.id = ${dto.paisDestinoId ?? ''}::text)
              OR ${dto.mode === 'continents'}
            )
          )
        )
      ), pairs AS (
        SELECT * FROM candidates ORDER BY score DESC, "origenId", "destinoId" LIMIT ${dto.limit ?? 50}
      )
      SELECT r.id, p."origenId", p."destinoId"
      FROM pairs p JOIN ofertas_ruta r ON r.escalas = 0 JOIN rutas conexion ON conexion.id=r.ruta_id AND (
        (conexion.origen_id = p."origenId" AND conexion.destino_id = p."destinoId") OR
        (conexion.destino_id = p."origenId" AND conexion.origen_id = p."destinoId")
      )
      ORDER BY p.score DESC, p."origenId", p."destinoId", r.id
    `
      .returnsRow({
        id: 'pg/text@1',
        origenId: 'pg/text@1',
        destinoId: 'pg/text@1',
      })
      .build(),
  );
}
