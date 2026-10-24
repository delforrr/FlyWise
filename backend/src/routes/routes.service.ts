import { and, or, type Condition } from '@prisma/orm-postgres/orm-client';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CollectionRowOf } from '@prisma/orm-postgres/orm-client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExploreRoutesDto } from './dto/explore-routes.dto.js';
import { QueryDirectRouteDto } from './dto/query-direct-route.dto.js';

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

  async explore(dto: ExploreRoutesDto): Promise<DeckGlArcRoute[]> {
    const { origin, airline, limit = 100 } = dto;

    const rows = await includeRouteDetails(this.prisma)
      .where((route) => {
        const conditions: Condition[] = [];
        if (origin) {
          const iata = origin.trim().toUpperCase();
          conditions.push(
            or(route.origin.some({ iata }), route.destination.some({ iata })),
          );
        }
        if (dto.originId)
          conditions.push(
            dto.destinationId
              ? route.originId.eq(dto.originId)
              : or(
                  route.originId.eq(dto.originId),
                  route.destinationId.eq(dto.originId),
                ),
          );
        if (dto.destinationId)
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
      ])
      .limit(limit)
      .all();
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
