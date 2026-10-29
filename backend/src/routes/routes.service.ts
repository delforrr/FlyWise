import { and, or, type Condition } from '@prisma/orm-postgres/orm-client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CollectionRowOf } from '@prisma/orm-postgres/orm-client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExploreRoutesDto } from './dto/explore-routes.dto.js';
import { QueryDirectRouteDto } from './dto/query-direct-route.dto.js';
import { GlobalRoutesDto } from './dto/global-routes.dto.js';
import { COUNTRY_CONTINENTS } from '../countries/continents.js';

export interface GlobalConnection {
  id: string;
  originId: string;
  destinationId: string;
  outbound: DeckGlArcRoute[];
  inbound: DeckGlArcRoute[];
}

export interface DeckGlArcRoute {
  id: string;
  origin: {
    id: string;
    icao: string | null;
    iata: string | null;
    name: string;
    city: string | null;
    country: string;
    coordinates: [number, number]; // [longitud, latitud] estándar Deck.gl
  };
  destination: {
    id: string;
    icao: string | null;
    iata: string | null;
    name: string;
    city: string | null;
    country: string;
    coordinates: [number, number]; // [longitud, latitud] estándar Deck.gl
  };
  airline: {
    iata: string | null;
    name: string;
  };
  distanceKm: number | null;
  distanceNm: number | null;
  otp15: null;
  stops: number;
}

function includeRouteDetails(prisma: PrismaService) {
  return prisma.models.Route.include('origin')
    .include('destination')
    .include('airline');
}

type RouteWithRelations = CollectionRowOf<
  ReturnType<typeof includeRouteDetails>
>;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async global(dto: GlobalRoutesDto): Promise<GlobalConnection[]> {
    if ((dto.mode === 'countries' && dto.originCountryId === dto.destinationCountryId) ||
        (dto.mode === 'continents' && dto.originContinent === dto.destinationContinent)) {
      throw new BadRequestException('Selecciona dos lugares diferentes');
    }
    const entries = Object.entries(COUNTRY_CONTINENTS);
    const originCodes = JSON.stringify(entries.filter(([, continent]) => dto.mode !== 'continents' || continent === dto.originContinent).map(([iso]) => iso));
    const destinationCodes = JSON.stringify(entries.filter(([, continent]) => dto.mode !== 'continents' || continent === dto.destinationContinent).map(([iso]) => iso));
    const symmetric = dto.mode === 'global' || dto.mode === 'domestic';
    const selected = await this.prisma.db.query(this.prisma.db.raw.sql`
      WITH candidates AS (
        SELECT DISTINCT
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.name), o.id) > (COALESCE(d.iata, d.icao, d.name), d.id) THEN d.id ELSE o.id END AS "originId",
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.name), o.id) > (COALESCE(d.iata, d.icao, d.name), d.id) THEN o.id ELSE d.id END AS "destinationId",
          o.route_count + d.route_count AS score
        FROM routes r
        JOIN airports o ON o.id = r.origin_id
        JOIN airports d ON d.id = r.destination_id
        LEFT JOIN countries oc ON oc.id = o.country_id
        LEFT JOIN countries dc ON dc.id = d.country_id
        WHERE r.stops = 0 AND (
          ${dto.mode === 'global'} OR (
            UPPER(TRIM(oc.iso_code)) IN (SELECT jsonb_array_elements_text(${originCodes}::jsonb))
            AND UPPER(TRIM(dc.iso_code)) IN (SELECT jsonb_array_elements_text(${destinationCodes}::jsonb))
            AND (
              (${dto.mode === 'domestic'} AND oc.id = ${dto.originCountryId ?? ''}::text AND dc.id = oc.id)
              OR (${dto.mode === 'countries'} AND oc.id = ${dto.originCountryId ?? ''}::text AND dc.id = ${dto.destinationCountryId ?? ''}::text)
              OR ${dto.mode === 'continents'}
            )
          )
        )
      ), pairs AS (
        SELECT * FROM candidates ORDER BY score DESC, "originId", "destinationId" LIMIT ${dto.limit ?? 50}
      )
      SELECT r.id, p."originId", p."destinationId"
      FROM pairs p JOIN routes r ON r.stops = 0 AND (
        (r.origin_id = p."originId" AND r.destination_id = p."destinationId") OR
        (r.destination_id = p."originId" AND r.origin_id = p."destinationId")
      )
      ORDER BY p.score DESC, p."originId", p."destinationId", r.id
    `.returnsRow({ id: 'pg/text@1', originId: 'pg/text@1', destinationId: 'pg/text@1' }).build());
    if (!selected.length) return [];
    const rows = await includeRouteDetails(this.prisma)
      .where((route) => or(...selected.map(({ id }) => route.id.eq(id))))
      .all();
    const arcs = new Map((await this.withDistances(rows)).map((row) => [row.id, this.mapToDeckGlArc(row)]));
    const connections = new Map<string, GlobalConnection>();
    for (const row of selected) {
      const arc = arcs.get(row.id);
      if (!arc) continue;
      const id = `${row.originId}/${row.destinationId}`;
      let connection = connections.get(id);
      if (!connection) {
        connection = { id, originId: row.originId, destinationId: row.destinationId, outbound: [], inbound: [] };
        connections.set(id, connection);
      }
      (arc.origin.id === row.originId ? connection.outbound : connection.inbound).push(arc);
    }
    return [...connections.values()];
  }

  async explore(dto: ExploreRoutesDto): Promise<DeckGlArcRoute[]> {
    const { origin, airline, limit = 100 } = dto;

    if (dto.includeReturn && (!dto.originId || !dto.destinationId)) {
      throw new BadRequestException('includeReturn requiere origen y destino');
    }
    const query = includeRouteDetails(this.prisma)
      .where((route) => {
        const conditions: Condition[] = [];
        if (origin) {
          const iata = origin.trim().toUpperCase();
          conditions.push(
            or(route.origin.some({ iata }), route.destination.some({ iata })),
          );
        }
        if (dto.includeReturn && dto.originId && dto.destinationId) {
          conditions.push(or(
            and(route.originId.eq(dto.originId), route.destinationId.eq(dto.destinationId)),
            and(route.originId.eq(dto.destinationId), route.destinationId.eq(dto.originId)),
          ));
        } else if (dto.originId)
          conditions.push(
            dto.destinationId
              ? route.originId.eq(dto.originId)
              : or(
                  route.originId.eq(dto.originId),
                  route.destinationId.eq(dto.originId),
                ),
          );
        if (dto.destinationId && !dto.includeReturn)
          conditions.push(route.destinationId.eq(dto.destinationId));
        if (dto.originId && dto.destinationId)
          conditions.push(route.stops.eq(0));
        if (airline)
          conditions.push(route.airlineCode.eq(airline.trim().toUpperCase()));
        return and(...conditions);
      })
      .orderBy([
        (route, { fns }) =>
          fns.raw`(SELECT route_count FROM airports WHERE id = ${route.originId})`
            .returns('pg/int4@1')
            .desc(),
        (route) => route.id.asc(),
      ]);
    const rows = await (dto.includeReturn ? query : query.limit(limit)).all();
    const routes = await this.withDistances(rows);

    return routes.map((r) => this.mapToDeckGlArc(r));
  }

  async findDirect(dto: QueryDirectRouteDto) {
    const originIata = dto.origin.trim().toUpperCase();
    const destinationIata = dto.destination.trim().toUpperCase();

    const rows = await includeRouteDetails(this.prisma)
      .where((route) =>
        and(
          route.origin.some({ iata: originIata }),
          route.destination.some({ iata: destinationIata }),
          route.stops.eq(0),
        ),
      )
      .all();
    const routes = await this.withDistances(rows);

    if (!routes.length) {
      throw new NotFoundException(
        `No se encontraron vuelos directos entre ${originIata} y ${destinationIata}`,
      );
    }

    const first = routes[0];
    const distanceKm = first.distanceKm;

    return {
      origin: {
        iata: first.origin.iata,
        name: first.origin.name,
        city: first.origin.city,
        country: first.origin.countryName,
        coordinates: [first.origin.longitude, first.origin.latitude],
      },
      destination: {
        iata: first.destination.iata,
        name: first.destination.name,
        city: first.destination.city,
        country: first.destination.countryName,
        coordinates: [first.destination.longitude, first.destination.latitude],
      },
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceNm: Math.round((distanceKm / 1.852) * 10) / 10,
      operatorsCount: routes.length,
      operators: routes.map((r) => ({
        airlineName: r.airline?.name ?? r.airlineCode ?? 'Desconocida',
        airlineIata: r.airline?.iata ?? r.airlineCode,
        stops: r.stops,
      })),
    };
  }

  private async withDistances(rows: RouteWithRelations[]) {
    const missing = rows;
    const distances = missing.length
      ? await this.prisma.db.query(
          this.prisma.db.raw.sql`
          SELECT r.id, ST_DistanceSphere(o.location::geometry, d.location::geometry) / 1000 AS "distanceKm"
          FROM routes r
          JOIN airports o ON o.id = r.origin_id
          JOIN airports d ON d.id = r.destination_id
          WHERE r.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(missing.map((route) => route.id))}::jsonb))
        `
            .returnsRow({ id: 'pg/text@1', distanceKm: 'pg/float8@1' })
            .build(),
        )
      : [];
    const byId = new Map(
      distances.map((route) => [route.id, route.distanceKm]),
    );
    return rows.map((route) => {
      const distanceKm = byId.get(route.id);
      if (distanceKm === undefined)
        throw new NotFoundException('La ruta ya no está disponible');
      return { ...route, distanceKm };
    });
  }

  private mapToDeckGlArc(
    route: RouteWithRelations & { distanceKm: number },
  ): DeckGlArcRoute {
    const distanceKm = route.distanceKm;

    return {
      id: route.id,
      origin: {
        id: route.origin.id,
        icao: route.origin.icao,
        iata: route.origin.iata,
        name: route.origin.name,
        city: route.origin.city,
        country: route.origin.countryName,
        coordinates: [route.origin.longitude, route.origin.latitude],
      },
      destination: {
        id: route.destination.id,
        icao: route.destination.icao,
        iata: route.destination.iata,
        name: route.destination.name,
        city: route.destination.city,
        country: route.destination.countryName,
        coordinates: [route.destination.longitude, route.destination.latitude],
      },
      airline: {
        iata: route.airline?.iata ?? route.airlineCode,
        name: route.airline?.name ?? route.airlineCode ?? 'Desconocida',
      },
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceNm: Math.round((distanceKm / 1.852) * 10) / 10,
      otp15: null,
      stops: route.stops,
    };
  }
}
