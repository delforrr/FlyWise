import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExploreRoutesDto } from './dto/explore-routes.dto';
import { QueryDirectRouteDto } from './dto/query-direct-route.dto';

export interface DeckGlArcRoute {
  id: string;
  origin: {
    iata: string;
    name: string;
    city: string | null;
    country: string;
    coordinates: [number, number]; // [longitud, latitud] estándar Deck.gl
  };
  destination: {
    iata: string;
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
  popularityScore: number;
  isTop100: boolean;
  stops: number;
}

export interface RouteWithRelations {
  id: string;
  airlineCode: string | null;
  originIata: string;
  destinationIata: string;
  stops: number;
  equipment: string | null;
  distanceKm: number | null;
  distanceNm: number | null;
  popularityScore: number;
  isTop100: boolean;
  origin: {
    iata: string | null;
    name: string;
    city: string | null;
    countryName: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    iata: string | null;
    name: string;
    city: string | null;
    countryName: string;
    latitude: number;
    longitude: number;
  };
  airline: {
    iata: string | null;
    name: string;
  } | null;
}

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async explore(dto: ExploreRoutesDto): Promise<DeckGlArcRoute[]> {
    const { origin, airline, limit = 100 } = dto;

    const where: Record<string, unknown> = {};

    if (origin) {
      const upperOrigin = origin.trim().toUpperCase();
      where.OR = [
        { originIata: upperOrigin },
        { destinationIata: upperOrigin },
      ];
    } else if (airline) {
      where.airlineCode = airline.trim().toUpperCase();
    } else {
      where.isTop100 = true;
    }

    const routes = (await this.prisma.route.findMany({
      where,
      include: {
        origin: true,
        destination: true,
        airline: true,
      },
      orderBy: {
        popularityScore: 'desc',
      },
      take: limit,
    })) as unknown as RouteWithRelations[];

    return routes.map((r) => this.mapToDeckGlArc(r));
  }

  async findDirect(dto: QueryDirectRouteDto) {
    const originIata = dto.origin.trim().toUpperCase();
    const destinationIata = dto.destination.trim().toUpperCase();

    const routes = (await this.prisma.route.findMany({
      where: {
        originIata,
        destinationIata,
      },
      include: {
        origin: true,
        destination: true,
        airline: true,
      },
    })) as unknown as RouteWithRelations[];

    if (!routes.length) {
      throw new NotFoundException(
        `No se encontraron vuelos directos entre ${originIata} y ${destinationIata}`,
      );
    }

    const first = routes[0];
    const distanceKm =
      first.distanceKm ??
      this.calculateDistance(
        first.origin.latitude,
        first.origin.longitude,
        first.destination.latitude,
        first.destination.longitude,
      );

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
        equipment: r.equipment,
      })),
    };
  }

  public calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radio medio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private mapToDeckGlArc(route: RouteWithRelations): DeckGlArcRoute {
    const distanceKm =
      route.distanceKm ??
      this.calculateDistance(
        route.origin.latitude,
        route.origin.longitude,
        route.destination.latitude,
        route.destination.longitude,
      );

    return {
      id: route.id,
      origin: {
        iata: route.origin.iata ?? route.originIata,
        name: route.origin.name,
        city: route.origin.city,
        country: route.origin.countryName,
        coordinates: [route.origin.longitude, route.origin.latitude],
      },
      destination: {
        iata: route.destination.iata ?? route.destinationIata,
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
      popularityScore: route.popularityScore,
      isTop100: route.isTop100,
      stops: route.stops,
    };
  }
}
