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
  const limit = dto.limit ?? 50;
  return await prisma.db.query(
    prisma.db.raw.sql`
      WITH candidates AS (
        SELECT
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.nombre), o.id) > (COALESCE(d.iata, d.icao, d.nombre), d.id) THEN d.id ELSE o.id END AS "origenId",
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.nombre), o.id) > (COALESCE(d.iata, d.icao, d.nombre), d.id) THEN o.id ELSE d.id END AS "destinoId",
          o.cantidad_rutas + d.cantidad_rutas AS score
        FROM rutas conexion
        JOIN aeropuertos o ON o.id = conexion.origen_id
        JOIN aeropuertos d ON d.id = conexion.destino_id
        LEFT JOIN paises oc ON oc.id = o.pais_id
        LEFT JOIN paises dc ON dc.id = d.pais_id
        WHERE conexion.archivado_en IS NULL AND o.archivado_en IS NULL AND d.archivado_en IS NULL
          AND EXISTS (
            SELECT 1 FROM ofertas_ruta r
            LEFT JOIN aerolineas a ON a.id = r.aerolinea_id
            WHERE r.ruta_id = conexion.id AND r.archivado_en IS NULL AND r.escalas = 0
              AND (r.aerolinea_id IS NULL OR (a.id IS NOT NULL AND a.archivado_en IS NULL))
          ) AND (
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
        -- Each pair has at most two directed routes, so this bound preserves the top unique pairs.
        ORDER BY score DESC, "origenId", "destinoId" LIMIT ${symmetric ? 2 * limit : limit}
      ), pairs AS (
        SELECT DISTINCT * FROM candidates ORDER BY score DESC, "origenId", "destinoId" LIMIT ${limit}
      ), directions AS (
        SELECT p.*, p."origenId" AS origin, p."destinoId" AS destination FROM pairs p
        UNION ALL
        SELECT p.*, p."destinoId" AS origin, p."origenId" AS destination FROM pairs p
      )
      SELECT r.id, p."origenId", p."destinoId"
      FROM directions p
      JOIN rutas conexion ON conexion.origen_id = p.origin AND conexion.destino_id = p.destination
      JOIN ofertas_ruta r ON r.ruta_id = conexion.id AND r.escalas = 0
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
